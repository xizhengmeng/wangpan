import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        {/* 预连接高频外部资源，降低图片和字体加载延迟 */}
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://pan.quark.cn" />
        <link rel="dns-prefetch" href="https://pan.quark.cn" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
