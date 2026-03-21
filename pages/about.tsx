import { InfoPage } from "@/components/InfoPage";

export default function AboutPage() {
  return (
    <InfoPage
      title="关于我们"
      description="夸克网盘资料是一个以搜索为核心的资料整理站，围绕频道、栏目、专题和资源进行持续组织与更新。"
      path="/about"
      eyebrow="About"
      sections={[
        {
          title: "网站定位",
          content: (
            <>
              <p>本站聚焦夸克网盘资料的检索、专题整理和内容组织，让用户先搜索，再进入频道和专题继续筛选。</p>
            </>
          ),
        },
        {
          title: "内容结构",
          content: (
            <>
              <p>内容按“频道 → 栏目 → 专题 → 资源”组织，覆盖教育考试、兴趣技能、语言学习、软件工具等方向。</p>
              <p>站内会根据热门搜索词、点击数据和无结果词持续补充新内容。</p>
            </>
          ),
        },
        {
          title: "更新原则",
          content: (
            <>
              <p>我们优先更新用户搜索需求明确、专题结构清晰、反馈集中且维护成本可控的内容。</p>
              <p>对于失效链接、错误归类或争议内容，会根据反馈及时修正或下线。</p>
            </>
          ),
        },
      ]}
    />
  );
}
