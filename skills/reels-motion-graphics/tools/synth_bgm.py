#!/usr/bin/env python3
"""외부 음원 없이 코드로 BGM 합성 (파이썬 기본 라이브러리만 사용, 설치 필요 없음).

사용:
  python3 synth_bgm.py --bpm 120 --seconds 30 --out public/bgm.wav --fps 30
  → public/bgm.wav       : 비트에 맞춘 일렉트로닉 BGM (44.1kHz 16bit 스테레오)
  → public/bgm.beats.json: {"bpm":120,"fps":30,"framesPerBeat":15,"beats":[0,15,30,...],"drop":240}
     Remotion 쪽에서 이 프레임 번호에 컷/전환을 맞추면 '비트에 딱딱 맞는' 영상이 된다.

구성 (마디 = 4비트):
  인트로 2마디(필터 걸린 패드+하이햇) → 빌드업 2마디(라이저) → 드롭(킥+베이스+코드) → 마지막 1마디 엔딩 스팅
같은 seed 면 언제 돌려도 똑같은 파일이 나온다.
"""
import argparse
import json
import math
import random
import struct
import wave

SR = 44100


def note_hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bpm", type=float, default=120)
    ap.add_argument("--seconds", type=float, default=30)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--key", type=int, default=57, help="근음 MIDI (57=A3, A단조)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default="bgm.wav")
    ap.add_argument("--mood", choices=["drive", "bright"], default="drive",
                    help="drive=단조 일렉트로닉(기본), bright=장조·마림바·부드러운 드럼(아이용·밝은 영상)")
    a = ap.parse_args()

    rnd = random.Random(a.seed)
    n = int(a.seconds * SR)
    spb = 60.0 / a.bpm  # seconds per beat
    beats_total = int(a.seconds / spb)
    bar = 4 * spb
    intro_end = 2 * bar
    drop_t = 4 * bar  # 드롭 시작 시각
    end_t = a.seconds - bar  # 마지막 마디는 엔딩

    bright = a.mood == "bright"
    if bright and a.key == 57:
        a.key = 60  # C major
    # drive: i - VI - III - VII (Am F C G) / bright: I - V - vi - IV (C G Am F)
    prog = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]] if bright else [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]]

    L = [0.0] * n
    R = [0.0] * n

    def add(i: int, l: float, r: float) -> None:
        if 0 <= i < n:
            L[i] += l
            R[i] += r

    # --- 패드 (디튠 톱니파 3개, 마디마다 코드 바뀜, 간단 로우패스) ---
    lp_l = lp_r = 0.0
    for i in range(n):
        t = i / SR
        if t >= end_t + spb:
            break
        chord = prog[int(t / bar) % 4]
        # 인트로엔 어둡게(컷오프 낮게) → 드롭 때 밝게
        cutoff = 0.06 if t < intro_end else (0.06 + 0.10 * min(1, (t - intro_end) / (drop_t - intro_end)) if t < drop_t else 0.16)
        s_l = s_r = 0.0
        for k, iv in enumerate(chord):
            f = note_hz(a.key + 12 + iv)
            for d, pan in ((-0.08, 0.8), (0.08, 0.2)):
                ph = (t * f * (1 + d / 100)) % 1.0
                v = (2 * ph - 1) * 0.09
                s_l += v * pan
                s_r += v * (1 - pan)
        lp_l += cutoff * (s_l - lp_l)
        lp_r += cutoff * (s_r - lp_r)
        L[i] += lp_l
        R[i] += lp_r

    # --- 드럼/베이스: 비트 단위로 찍기 ---
    for b in range(beats_total + 1):
        t0 = b * spb
        if t0 >= a.seconds:
            break
        in_drop = drop_t <= t0 < end_t
        # 킥 (드롭 구간 매 비트 + 엔딩 첫 박)
        if (in_drop and (not bright or b % 2 == 0)) or abs(t0 - end_t) < 1e-6:
            for j in range(int(0.35 * SR)):
                tt = j / SR
                f = 45 + 110 * math.exp(-tt * 28)
                v = math.sin(2 * math.pi * f * tt) * math.exp(-tt * 7) * (0.55 if bright else 0.9)
                add(int(t0 * SR) + j, v, v)
        # 하이햇 (엇박) — 인트로부터
        if t0 < end_t:
            th = t0 + spb / 2
            for j in range(int(0.05 * SR)):
                v = (rnd.random() * 2 - 1) * math.exp(-j / SR * 90) * (0.10 if in_drop else 0.09)
                add(int(th * SR) + j, v * 0.7, v)
        # 클랩 (드롭 구간 2, 4박)
        if in_drop and b % 2 == 1:
            for j in range(int(0.18 * SR)):
                tt = j / SR
                v = (rnd.random() * 2 - 1) * math.exp(-tt * (45 if bright else 22)) * (0.18 if bright else 0.35)
                add(int(t0 * SR) + j, v, v * 0.9)
        # 베이스 (드롭 구간 8분음표, 코드 근음)
        if in_drop:
            root = prog[int(t0 / bar) % 4][0]
            f = note_hz(a.key - 12 + root)
            for half in (0, 1):
                ts = t0 + half * spb / 2
                for j in range(int(spb / 2 * SR * 0.9)):
                    tt = j / SR
                    ph = (tt * f) % 1.0
                    sq = (1 if ph < 0.5 else -1) * 0.5 + math.sin(2 * math.pi * f * tt) * 0.5
                    v = sq * 0.22 * min(1, tt * 200) * math.exp(-tt * 3)
                    add(int(ts * SR) + j, v, v)

    # --- 마림바 아르페지오 (bright): 8분음표로 코드음 위아래, 인트로부터 ---
    if bright:
        pattern = [0, 1, 2, 1, 2, 0, 1, 2]
        steps = int(a.seconds / (spb / 2))
        for k in range(steps):
            ts = k * spb / 2
            if ts >= end_t:
                break
            ch = prog[int(ts / bar) % 4]
            note = a.key + 12 + ch[pattern[k % 8]] + (12 if k % 16 >= 12 else 0)
            f = note_hz(note)
            g = 0.16 if ts >= drop_t else 0.11
            pan = 0.35 + 0.3 * ((k % 4) / 3)
            for j in range(int(0.45 * SR)):
                tt = j / SR
                env = math.exp(-tt * 9) * min(1, tt * 800)
                v = (math.sin(2 * math.pi * f * tt) + 0.35 * math.sin(2 * math.pi * f * 4 * tt) * math.exp(-tt * 30)) * env * g
                add(int(ts * SR) + j, v * pan * 2, v * (1 - pan) * 2)

    # --- 라이저 (빌드업 2마디: 노이즈 볼륨↑ + 상승 사인) ---
    rs, re_ = int(intro_end * SR), int(drop_t * SR)
    for i in range(rs, min(re_, n)):
        p = (i - rs) / (re_ - rs)
        tt = (i - rs) / SR
        v = (rnd.random() * 2 - 1) * (0.05 if bright else 0.12) * p ** 2 + math.sin(2 * math.pi * (300 + 900 * p * p) * tt) * (0.025 if bright else 0.05) * p
        L[i] += v
        R[i] += v

    # --- 엔딩 스팅 (마지막 마디 첫 박: 코드 한 방 + 긴 꼬리) ---
    s0 = int(end_t * SR)
    chord = [0, 7, 12, 15, 19]
    for j in range(int(min(bar, a.seconds - end_t) * SR)):
        tt = j / SR
        env = math.exp(-tt * 1.6)
        v = sum(math.sin(2 * math.pi * note_hz(a.key + iv) * tt) for iv in chord) * 0.14 * env
        add(s0 + j, v, v)

    # 페이드 인/아웃 + 소프트 클립 + 정규화
    fade = int(0.02 * SR)
    peak = 1e-9
    for i in range(n):
        g = min(1.0, i / fade, (n - 1 - i) / fade)
        L[i] = math.tanh(L[i] * 1.2) * g
        R[i] = math.tanh(R[i] * 1.2) * g
        peak = max(peak, abs(L[i]), abs(R[i]))
    k = 0.89 / peak

    with wave.open(a.out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<hh", int(L[i] * k * 32767), int(R[i] * k * 32767)) for i in range(n)))

    fpb = a.fps * spb
    meta = {
        "bpm": a.bpm,
        "fps": a.fps,
        "framesPerBeat": fpb,
        "beats": [round(b * fpb) for b in range(beats_total + 1) if b * spb < a.seconds],
        "buildup": round(intro_end * a.fps),
        "drop": round(drop_t * a.fps),
        "ending": round(end_t * a.fps),
    }
    meta_path = a.out.rsplit(".", 1)[0] + ".beats.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f)
    print(f"wrote {a.out} ({a.seconds}s, {a.bpm}bpm) and {meta_path}")


if __name__ == "__main__":
    main()
