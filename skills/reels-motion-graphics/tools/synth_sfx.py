#!/usr/bin/env python3
"""모션그래픽용 효과음 7종을 코드로 합성 (파이썬 기본 라이브러리만, 저작권 없음).

사용:
  python3 synth_sfx.py --out public/sfx
  → whoosh.wav (휙: 전환)  hit.wav (쿵: 슬램/착지)  pop.wav (뽁: 숫자·카드 등장)
    click.wav (딸깍: UI·커서)  stamp.wav (쾅+잔향: 도장/로고)  ding.wav (띵: 완료·체크)
    tick.wav (틱: 카운트업 중 짧게 반복)

Remotion 에서:
  <Sequence from={착지프레임}><Audio src={staticFile("sfx/hit.wav")} volume={0.8} /></Sequence>
효과음은 '움직임이 끝나는(착지) 프레임' 에 둔다. 시작 프레임이 아니다.
"""
import argparse
import math
import os
import random
import struct
import wave

SR = 44100


def write(path: str, x: list[float], peak: float = 0.9) -> None:
    m = max(1e-9, max(abs(v) for v in x))
    k = peak / m
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v * k)) * 32767)) for v in x))


def lp(x: list[float], a: float) -> list[float]:
    y, s = [], 0.0
    for v in x:
        s += a * (v - s)
        y.append(s)
    return y


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="sfx")
    ap.add_argument("--seed", type=int, default=3)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    r = random.Random(a.seed)
    noise = lambda n: [r.random() * 2 - 1 for _ in range(n)]

    # whoosh: 필터가 열렸다 닫히는 노이즈 (0.45s)
    n = int(0.45 * SR)
    src = noise(n)
    out, s = [], 0.0
    for i, v in enumerate(src):
        p = i / n
        cut = 0.02 + 0.25 * math.sin(math.pi * p) ** 2
        s += cut * (v - s)
        out.append(s * math.sin(math.pi * p) ** 1.5)
    write(os.path.join(a.out, "whoosh.wav"), out, 0.7)

    # hit: 피치가 떨어지는 사인 + 짧은 노이즈 클릭 (0.5s)
    n = int(0.5 * SR)
    out = []
    ph = 0.0
    for i in range(n):
        t = i / SR
        f = 40 + 140 * math.exp(-t * 30)
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-t * 6) + (r.random() * 2 - 1) * math.exp(-t * 120) * 0.4)
    write(os.path.join(a.out, "hit.wav"), [math.tanh(v * 1.5) for v in out])

    # pop: 짧게 위로 튀는 사인 (0.12s)
    n = int(0.12 * SR)
    out, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = 500 + 900 * (1 - math.exp(-t * 60))
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-t * 35) * min(1, t * 2000))
    write(os.path.join(a.out, "pop.wav"), out, 0.6)

    # click: 아주 짧은 고역 클릭 (0.04s)
    n = int(0.04 * SR)
    src = noise(n)
    out = [(src[i] - (src[i - 1] if i else 0)) * math.exp(-i / SR * 250) for i in range(n)]
    write(os.path.join(a.out, "click.wav"), out, 0.5)

    # stamp: 쿵(저역) + 탁(중역 노이즈) + 짧은 방 울림 (0.9s)
    n = int(0.9 * SR)
    body = noise(n)
    mid = lp(body, 0.25)
    out, ph = [], 0.0
    for i in range(n):
        t = i / SR
        ph += 2 * math.pi * (60 + 60 * math.exp(-t * 40)) / SR
        out.append(math.sin(ph) * math.exp(-t * 9) * 0.9 + mid[i] * math.exp(-t * 45) * 1.4)
    # 초간단 잔향: 지연 3개
    for d, g in ((0.023, 0.35), (0.041, 0.25), (0.067, 0.18)):
        k = int(d * SR)
        for i in range(n - 1, k - 1, -1):
            out[i] += out[i - k] * g
    write(os.path.join(a.out, "stamp.wav"), [math.tanh(v) for v in out])

    # ding: 종 소리 (배음 비정수) (1.2s)
    n = int(1.2 * SR)
    partials = [(1, 1.0), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)]
    out = []
    for i in range(n):
        t = i / SR
        out.append(sum(g * math.sin(2 * math.pi * 1046.5 * m * t) * math.exp(-t * (3 + m)) for m, g in partials)
                   * min(1, t * 400))
    write(os.path.join(a.out, "ding.wav"), out, 0.5)

    # tick: 카운트업용 아주 짧은 틱 (0.03s)
    n = int(0.03 * SR)
    out = [math.sin(2 * math.pi * 2400 * i / SR) * math.exp(-i / SR * 220) for i in range(n)]
    write(os.path.join(a.out, "tick.wav"), out, 0.35)

    print("wrote", ", ".join(sorted(f for f in os.listdir(a.out) if f.endswith(".wav"))), "→", a.out)


if __name__ == "__main__":
    main()
