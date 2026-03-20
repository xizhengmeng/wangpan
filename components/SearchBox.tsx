"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/router";

interface SearchBoxProps {
  initialQuery?: string;
}

export function SearchBox({ initialQuery = "" }: SearchBoxProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) {
      return;
    }

    void router.push(`/search?q=${encodeURIComponent(nextQuery)}`);
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <input
        aria-label="搜索资料"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="输入关键词，例如：考研数学、PPT 模板、Python"
      />
      <button type="submit">开始搜索</button>
    </form>
  );
}
