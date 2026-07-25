import type { NextConfig } from "next";

// 이 브랜치는 API 계층(app/api/**)만 갖는다 — React 컴포넌트가 없으므로
// reactCompiler 는 켜지 않는다 (UI 는 frontend 브랜치 소유).
const nextConfig: NextConfig = {};

export default nextConfig;
