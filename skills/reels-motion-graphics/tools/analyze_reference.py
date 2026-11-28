#!/usr/bin/env python3
"""레퍼런스 영상/음악을 '숫자와 그림' 으로 바꿔서 클로드가 따라 만들 수 있게 한다.

클로드는 영상을 재생하거나 소리를 들을 수 없다. 대신:
  - 컷이 바뀌는 순간마다 한 장씩 뽑아 컨택트시트(cuts.png) 로 보고 → 스타일·구도·색을 읽고
  - 1초에 1장 시트(timeline.png) 로 전체 흐름·속도감을 보고
  - 오디오 파형을 숫자로 분석해 BPM·비트·강한 타격(hit) 시각을 얻어 → 컷과 효과음을 맞춘다.

사용:
  python3 analyze_reference.py reference.mp4 --out ref/          # 영상 (+ 오디오 있으면 같이)
  python3 analyze_reference.py music.mp3 --out ref/ --fps 30     # 음악만 → 비트 프레임 계산

출력:
  ref/analysis.json  {duration, width, height, fps, cuts[], avgShotSec, bpm, beats[], hits[], cutsOnBeat, ...}
  ref/cuts.png       장면마다 1장 (장면 길이의 60% 지점, 최대 24장, 순서대로 = cutsSheetTimes)
  ref/timeline.png   1초 1장 (최대 40장)

필요: ffmpeg/ffprobe (시스템 설치본. Remotion 내장 ffmpeg 는 장면 감지 필터가 없을 수 있음)
파이썬 기본 라이브러리만 사용.
"""
import argparse
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=False)


def probe(path: str) -> dict:
    r = run(["ffprobe", "-v", "error", "-show_entries",
             "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", path])
    info = json.loads(r.stdout or b"{}")
    out = {"duration": float(info.get("format", {}).get("duration", 0)), "hasVideo": False, "hasAudio": False}
    for s in info.get("streams", []):
        if s.get("codec_type") == "video" and not out["hasVideo"]:
            out["hasVideo"] = True
            out["width"], out["height"] = s.get("width"), s.get("height")
            num, den = (s.get("r_frame_rate") or "0/1").split("/")
            out["fps"] = round(float(num) / float(den or 1), 3) if float(den or 1) else 0
        if s.get("codec_type") == "audio":
            out["hasAudio"] = True
    return out


def scene_cuts(path: str, threshold: float) -> list[float]:
    r = run(["ffmpeg", "-hide_banner", "-i", path, "-vf", f"select='gt(scene,{threshold})',showinfo",
             "-an", "-f", "null", "-"])
    times = [float(m) for m in re.findall(rb"pts_time:([0-9.]+)", r.stderr)]
    cuts = [0.0]
    for t in times:
        if t - cuts[-1] > 0.15:  # 플래시 등으로 연달아 잡힌 컷은 하나로
            cuts.append(t)
    return cuts


def tile_frames(path: str, times: list[float], out_png: str, width: int, cols: int) -> None:
    """지정 시각들의 프레임을 뽑아 격자 한 장으로."""
    tmp = out_png + ".frames"
    os.makedirs(tmp, exist_ok=True)
    for i, t in enumerate(times):
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", path,
             "-frames:v", "1", "-vf", f"scale={width}:-2", os.path.join(tmp, f"f{i:03d}.png")])
    rows = max(1, math.ceil(len(times) / cols))
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-i",
         os.path.join(tmp, "f%03d.png"), "-vf", f"tile={cols}x{rows}:padding=4:color=white",
         "-frames:v", "1", out_png])
    shutil.rmtree(tmp, ignore_errors=True)


def contact_sheets(path: str, out: str, cuts: list[float], duration: float) -> list[float]:
    # 장면 시작 프레임은 모션그래픽에서 대개 비어 있다 → 각 장면의 60% 지점을 뽑는다
    ends = cuts[1:] + [duration]
    picks = [round(c + 0.6 * (e - c), 3) for c, e in zip(cuts, ends)][:24]
    tile_frames(path, picks, os.path.join(out, "cuts.png"), 240, 6)
    every = [float(t) + 0.5 for t in range(min(40, max(1, int(duration))))]
    tile_frames(path, every, os.path.join(out, "timeline.png"), 180, 8)
    return picks


def decode_mono(path: str, sr: int) -> list[float]:
    r = run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr),
             "-f", "s16le", "-"])
    raw = r.stdout
    cnt = len(raw) // 2
    return [x / 32768 for x in struct.unpack(f"<{cnt}h", raw[: cnt * 2])]


def analyze_audio(path: str, fps: float) -> dict:
    sr, hop = 22050, 441  # 20ms 단위
    x = decode_mono(path, sr)
    if not x:
        return {}
    # 1) 구간별 에너지(RMS) → 2) 증가분만 남긴 onset 강도(spectral flux 대용)
    env = []
    for i in range(0, len(x) - hop, hop):
        seg = x[i:i + hop]
        # 저역(킥)·고역(하이햇)을 대충 나누기 위해 1차 차분(고역 강조) 에너지도 같이 본다
        e = sum(v * v for v in seg) / hop
        hd = sum((seg[k] - seg[k - 1]) ** 2 for k in range(1, hop)) / hop
        env.append(math.sqrt(e) + 0.5 * math.sqrt(hd))
    onset = [0.0] + [max(0.0, env[i] - env[i - 1]) for i in range(1, len(env))]
    rate = sr / hop  # onset 프레임/초 (50)

    # BPM: onset 자기상관, 70~180 BPM 범위에서 최대
    best_bpm, best = 0.0, -1.0
    mean = sum(onset) / len(onset)
    o = [v - mean for v in onset]
    for bpm10 in range(700, 1801, 5):
        bpm = bpm10 / 10
        lag = rate * 60 / bpm
        l0 = int(lag)
        fr = lag - l0
        s = 0.0
        for i in range(len(o) - l0 - 1):
            s += o[i] * (o[i + l0] * (1 - fr) + o[i + l0 + 1] * fr)
        # 템포 사전확률: 100~130 근처를 살짝 선호 (반/배 템포 혼동 줄이기)
        s *= math.exp(-0.5 * (math.log2(bpm / 120)) ** 2 / 0.6 ** 2)
        if s > best:
            best, best_bpm = s, bpm
    period = rate * 60 / best_bpm
    # 위상: 비트 격자에 onset 합이 최대가 되는 시작점
    best_phase, best_sum = 0, -1.0
    for ph in range(int(period)):
        s = sum(onset[int(ph + k * period)] for k in range(int((len(onset) - ph) / period)))
        if s > best_sum:
            best_sum, best_phase = s, ph
    beats = []
    k = 0
    while best_phase + k * period < len(onset):
        beats.append(round((best_phase + k * period) / rate, 3))
        k += 1
    # 강한 타격: onset 상위 값 중 최소 0.25초 간격
    thr = sorted(onset)[int(len(onset) * 0.97)] if len(onset) > 30 else 0
    hits, last = [], -1.0
    for i, v in enumerate(onset):
        t = i / rate
        if v >= thr and v > 0 and t - last > 0.25:
            hits.append(round(t, 3))
            last = t
    # 크게 바뀌는 지점(드롭 후보): 2초 평균 에너지가 가장 크게 뛰는 곳
    w = int(rate * 2)
    drop = None
    if len(env) > 2 * w:
        jumps = [(sum(env[i:i + w]) - sum(env[i - w:i]), i) for i in range(w, len(env) - w, int(rate / 2))]
        j = max(jumps)
        if j[0] > 0:
            drop = round(j[1] / rate, 3)
    res = {
        "bpm": round(best_bpm, 1),
        "beats": beats,
        "hits": hits[:200],
        "dropCandidate": drop,
    }
    if fps:
        res["fps"] = fps
        res["framesPerBeat"] = round(fps * 60 / best_bpm, 3)
        res["beatFrames"] = [round(b * fps) for b in beats]
        res["hitFrames"] = [round(h * fps) for h in res["hits"]]
        if drop is not None:
            res["dropFrame"] = round(drop * fps)
    return res


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--out", default="ref")
    ap.add_argument("--fps", type=float, default=30, help="내 영상 fps (비트→프레임 변환용)")
    ap.add_argument("--scene", type=float, default=0.3, help="컷 감지 민감도 (낮을수록 많이 잡음)")
    a = ap.parse_args()

    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        sys.exit("ffmpeg/ffprobe 가 필요합니다 (brew install ffmpeg / winget install ffmpeg)")
    os.makedirs(a.out, exist_ok=True)
    info = probe(a.input)
    result: dict = {"input": os.path.basename(a.input), **info}

    if info["hasVideo"]:
        cuts = scene_cuts(a.input, a.scene)
        shots = [b - c for c, b in zip(cuts, cuts[1:] + [info["duration"]])]
        result["cuts"] = [round(c, 3) for c in cuts]
        result["shotCount"] = len(cuts)
        result["avgShotSec"] = round(sum(shots) / len(shots), 2) if shots else None
        result["shortestShotSec"] = round(min(shots), 2) if shots else None
        result["cutsSheetTimes"] = contact_sheets(a.input, a.out, cuts, info["duration"])

    if info["hasAudio"]:
        result["audio"] = analyze_audio(a.input, a.fps)
        if info["hasVideo"] and result["audio"].get("beats"):
            beats = result["audio"]["beats"]
            tol = 0.08
            on = sum(1 for c in result["cuts"][1:] if any(abs(c - b) <= tol for b in beats))
            result["cutsOnBeat"] = f"{on}/{max(0, len(result['cuts']) - 1)}"

    with open(os.path.join(a.out, "analysis.json"), "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    s = {k: result[k] for k in ("duration", "width", "height", "shotCount", "avgShotSec", "cutsOnBeat") if k in result}
    if "audio" in result:
        s["bpm"] = result["audio"].get("bpm")
        s["dropCandidate"] = result["audio"].get("dropCandidate")
    print(json.dumps(s, ensure_ascii=False))


if __name__ == "__main__":
    main()
