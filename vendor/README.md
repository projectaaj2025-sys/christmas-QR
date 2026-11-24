# vendor/encoders.js

Собранный браузерный бандл двух библиотек, чтобы кодировать анимацию в GIF и MP4
прямо на странице, без сервера:

- [gifenc](https://github.com/mattdesl/gifenc) 1.0.3 — MIT — GIF-энкодер (квантование + LZW);
- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) 5.2.2 — MIT — упаковка кадров в MP4.

Экспортирует в `window`: `GIFEncoder`, `quantize`, `applyPalette`, `Mp4Muxer`, `Mp4Target`.

Пересобрать после обновления зависимостей:

```bash
node scripts/build-vendor.mjs
```

## Лицензии

Обе библиотеки распространяются по лицензии MIT. Текст:

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
