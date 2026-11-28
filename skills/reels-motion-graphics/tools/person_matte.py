#!/usr/bin/env python3
"""촬영본에서 사람만 오려낸 '투명 배경 영상' 을 만든다 (누끼). 배경 교체·사람 뒤로 지나가는 글자용.

사용:
  pip install mediapipe opencv-python numpy
  python3 person_matte.py my_clip.mp4 --out public/cut
  → public/cut/person.webm   사람만 남은 VP9 알파 영상 (Remotion: <OffthreadVideo transparent />)
    public/cut/person.mov    같은 내용 ProRes 4444 (캡컷·프리미어용, --prores 일 때)
    public/cut/matte.mp4     흑백 마스크 (확인용)
    public/cut/check.png     첫 프레임 확인 이미지 (체크무늬 위 사람)

모델: MediaPipe selfie_multiclass (머리카락·얼굴·몸·옷을 구분 → 사람 = 배경이 아닌 곳). 처음 실행 때 자동 다운로드.
품질 팁: 배경과 옷 색이 비슷하거나 손이 빠르게 움직이면 가장자리가 흔들릴 수 있다 → --smooth 를 올리면 덜 흔들림.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request

import numpy as np

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                        "-of", "json", path], capture_output=True, text=True)
    s = json.loads(r.stdout)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return s["width"], s["height"], float(num) / float(den)


def guided(I, p, r, eps):
    """가이드 필터 (He et al.): 원본 밝기의 윤곽을 따라 마스크 경계를 다듬는다 (계단 현상 제거)."""
    import cv2
    m = lambda x: cv2.blur(x, (r, r))
    mI, mp_, mIp, mII = m(I), m(p), m(I * p), m(I * I)
    a = (mIp - mI * mp_) / (mII - mI * mI + eps)
    b = mp_ - a * mI
    return m(a) * I + m(b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--out", default="cut")
    ap.add_argument("--model", default=os.path.expanduser("~/.cache/person_matte/selfie_multiclass.tflite"))
    ap.add_argument("--smooth", type=float, default=0.3, help="시간 방향 평활화 0~0.9 (높을수록 덜 떨림, 빠른 동작은 끌림)")
    ap.add_argument("--edge", type=float, default=0.8, help="가장자리 부드럽게 (px)")
    ap.add_argument("--prores", action="store_true", help="ProRes 4444 .mov 도 함께 출력")
    ap.add_argument("--all-people", action="store_true", help="모든 사람 유지 (기본: 가장 큰 사람 = 주인공만. 셀카 모델은 뒤쪽 작은 사람을 반쯤만 잡아 깜빡이므로)")
    a = ap.parse_args()

    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    if not os.path.exists(a.model):
        os.makedirs(os.path.dirname(a.model), exist_ok=True)
        print("모델 다운로드:", MODEL_URL)
        urllib.request.urlretrieve(MODEL_URL, a.model)
    os.makedirs(a.out, exist_ok=True)
    W, H, fps = probe(a.input)

    seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
        base_options=BaseOptions(model_asset_path=a.model), running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True))

    reader = subprocess.Popen(["ffmpeg", "-v", "error", "-i", a.input, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    common = ["-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", f"{fps}", "-i", "-"]
    w_webm = subprocess.Popen(["ffmpeg", "-v", "error", "-y", *common, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "6M", "-auto-alt-ref", "0",
                               os.path.join(a.out, "person.webm")], stdin=subprocess.PIPE)
    w_mov = subprocess.Popen(["ffmpeg", "-v", "error", "-y", *common, "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
                              os.path.join(a.out, "person.mov")], stdin=subprocess.PIPE) if a.prores else None
    w_matte = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", f"{fps}", "-i", "-",
                                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", os.path.join(a.out, "matte.mp4")], stdin=subprocess.PIPE)

    prev = None
    n = 0
    fsize = W * H * 3
    while True:
        buf = reader.stdout.read(fsize)
        if len(buf) < fsize:
            break
        rgb = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        res = seg.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(n * 1000 / fps))
        bg = res.confidence_masks[0].numpy_view()  # 0번 클래스 = 배경
        person = 1.0 - cv2.resize(bg, (W, H), interpolation=cv2.INTER_CUBIC)
        # 주인공 영역: 경계 다듬기 '전' 원래 마스크로 덩어리를 나눈다 (다듬기 필터가 옆사람과 이어 붙이는 것 방지)
        keep = None
        if not a.all_people:  # 주인공(가장 큰 덩어리)만 → 뒤쪽 사람이 반투명하게 깜빡이는 것 방지
            k = max(15, int(min(W, H) / 30)) | 1  # 가는 연결(머리카락끼리 닿은 곳)을 끊을 만큼 깎는다
            core = cv2.erode((person > 0.5).astype(np.uint8), np.ones((k, k), np.uint8))
            nlab, lab, stats, _ = cv2.connectedComponentsWithStats(core, 8)
            if nlab >= 2:
                keep = (lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
                keep = cv2.dilate(keep, np.ones((k + 24, k + 24), np.uint8)).astype(np.float32)  # 깎은 만큼 + 여유 되돌리기
                keep = np.clip(cv2.GaussianBlur(keep, (0, 0), 6), 0, 1)
        # 가장자리 정리: 실제 윤곽에 맞춤 → 대비 올리기(반투명 줄이기) → 주인공 밖 지우기
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        r = max(8, int(min(W, H) / 60))
        person = guided(gray, person.astype(np.float32), r, 1e-3)
        person = np.clip((person - 0.25) / 0.5, 0, 1)
        person = person * person * (3 - 2 * person)
        if keep is not None:
            person = person * keep
        if prev is not None:
            person = a.smooth * prev + (1 - a.smooth) * person
        prev = person
        if a.edge > 0:
            person = cv2.GaussianBlur(person, (0, 0), a.edge)
        alpha = (person * 255).astype(np.uint8)
        rgba = np.dstack([rgb, alpha])
        w_webm.stdin.write(rgba.tobytes())
        if w_mov:
            w_mov.stdin.write(rgba.tobytes())
        w_matte.stdin.write(alpha.tobytes())
        if n == 0:  # 확인 이미지: 체크무늬 위에 사람
            yy, xx = np.mgrid[0:H, 0:W]
            checker = (((yy // 32 + xx // 32) % 2) * 60 + 160).astype(np.float32)[..., None].repeat(3, 2)
            comp = rgb * person[..., None] + checker * (1 - person[..., None])
            cv2.imwrite(os.path.join(a.out, "check.png"), cv2.cvtColor(comp.astype(np.uint8), cv2.COLOR_RGB2BGR))
        n += 1
    for p in [w_webm, w_mov, w_matte]:
        if p:
            p.stdin.close()
            p.wait()
    reader.wait()
    seg.close()  # 명시적으로 닫아야 종료 시 오류가 안 남
    print(f"{n} frames → {a.out}/person.webm" + (" + person.mov" if a.prores else "") + " + matte.mp4 + check.png")


if __name__ == "__main__":
    sys.exit(main())
