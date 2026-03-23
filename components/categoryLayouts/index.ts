import type { CategoryLayoutProps } from "./types";
import DefaultCategoryLayout from "./DefaultCategoryLayout";
import MiddleSchoolLayout from "./MiddleSchoolLayout";

export type CategoryLayoutComponent = (props: CategoryLayoutProps) => JSX.Element;

/**
 * 在这里注册需要定制布局的栏目 slug。
 * 如果某个 slug 没有注册，会自动使用 DefaultCategoryLayout。
 *
 * 示例：
 *   import HighSchoolLayout from "./HighSchoolLayout";
 *   "high-school": HighSchoolLayout,
 */
const registry: Partial<Record<string, CategoryLayoutComponent>> = {
  "middle-school": MiddleSchoolLayout,
};

export function getCategoryLayout(slug: string): CategoryLayoutComponent {
  return registry[slug] ?? DefaultCategoryLayout;
}

export { DefaultCategoryLayout };
export type { CategoryLayoutProps };
