# 犬の素材

生成方法：組み込み image_gen（imagegen スキル）。参照は `jikkun.jpg`（犬のモデル）と `image.png`（立体的な毛並みの表現）。生成画像をワークスペースへコピーし、透過PNGをそのまま使用します。

## 通常フレーム

保存先：`frontend/public/assets/jikkun.png`

```text
Use case: stylized-concept. Asset type: transparent PNG mascot for a Japanese minimal budgeting app. Image 1 is identity reference (the real black dog jikkun); Image 2 is STYLE reference only (the premium fluffy 3D animal in a peach mobile UI). Create ONE full-body seated small black shaggy toy poodle based on image 1, rounded floppy ears, soft charcoal fur with subtle gray muzzle, warm dark eyes, wearing its teal knit shirt with cream horizontal stripes. Premium tactile 3D rendered furry character, friendly and calm, not exaggerated baby proportions. Front facing, head upright with a subtle inquisitive expression, paws resting, entire body visible. Centered on square 1024x1024 canvas filling 85% height. Soft warm studio light, detailed dimensional fur. GENUINELY TRANSPARENT alpha background, no colored or white backdrop, no floor, no UI, no text, no plants, no objects, no hard cast shadow. Keep the eyes clearly visible to permit a gentle blink animation.
```

## まばたきフレーム

保存先：`frontend/public/assets/jikkun-blink.png`

```text
Use case: precise-object-edit. Edit the supplied transparent dog PNG for a two-frame blink animation. Change ONLY both eyes: gently close both eyelids naturally for a calm blink, with matching charcoal fur. CRITICAL keep exactly identical canvas dimensions, dog position, silhouette, pose, fur, ears, head angle, shirt, lighting, alpha and all pixels outside the eyes. No other changes, no rescaling or cropping. Genuine transparent background preserved. This is the closed-eyes frame of the same dog.
```

まばたき画像はCSSで目の周囲だけを表示して重ねます。呼吸は全体、首かしげは同じ通常画像からマスクした頭部のみへ適用します。動きを減らす設定では通常フレームの静止表示になります。
