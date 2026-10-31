# parksehyn.github.io

박세현의 이력서 · 포트폴리오 사이트입니다. → https://parksehyn.github.io

- 내용은 `data/resume.yml` 한 파일에서 관리합니다. 빈 값은 화면에 나타나지 않습니다.
- `src/build.mjs`가 YAML을 읽어 정적 HTML(`dist/`)을 만들고, `main`에 push하면 GitHub Actions가 Pages로 배포합니다.
- PDF가 필요하면 브라우저에서 인쇄 → PDF로 저장 (인쇄용 스타일 포함).

```bash
npm install
npm run build      # dist/ 생성
npm run preview    # 로컬 미리보기
```
