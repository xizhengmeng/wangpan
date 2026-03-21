import { InfoPage } from "@/components/InfoPage";

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "待补充";

export default function ContactPage() {
  return (
    <InfoPage
      title="联系我们"
      description="如果你有资源失效、内容纠错、版权说明或合作需求，可以通过以下方式联系站点。"
      path="/contact"
      eyebrow="Contact"
      sections={[
        {
          title: "联系渠道",
          content: (
            <>
              <p>联系邮箱：{contactEmail}</p>
              <p>如果邮箱尚未公开，当前也可以通过资源详情页中的失效反馈入口提交问题。</p>
            </>
          ),
        },
        {
          title: "适合反馈的内容",
          content: (
            <ul>
              <li>资源链接失效或提取码错误</li>
              <li>专题归类不准确或搜索结果不合理</li>
              <li>版权、展示或内容合规问题</li>
              <li>内容合作、资源补充与站点建议</li>
            </ul>
          ),
        },
        {
          title: "处理说明",
          content: (
            <>
              <p>涉及失效修复和内容纠错的问题，会优先进入站点维护队列；涉及版权或合规问题的内容，会优先核查并按需下线。</p>
            </>
          ),
        },
      ]}
    />
  );
}
