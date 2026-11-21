"""Find relevant topics in the bundled Chinese study references."""

import argparse
from pathlib import Path
import re
import sys
import unicodedata


def normalize(text):
    return unicodedata.normalize("NFKC", text).casefold()


def search(chapter_dir, query):
    phrase = normalize(query).strip()
    terms = phrase.split()
    if not terms:
        return []
    matches = []
    for chapter in sorted(chapter_dir.glob("ch[0-9][0-9].md")):
        text = chapter.read_text(encoding="utf-8")
        headings = list(re.finditer(r"^## (.+)$", text, re.MULTILINE))
        for index, heading in enumerate(headings):
            title = heading[1]
            if title in {"考试范围提示", "自编练习索引"}:
                continue
            end = headings[index + 1].start() if index + 1 < len(headings) else len(text)
            body = text[heading.end():end].strip()
            title_key, body_key = normalize(title), normalize(body)
            if all(term in title_key or term in body_key for term in terms):
                score = 4 * sum(term in title_key for term in terms) + int(phrase in title_key)
                page = next((line for line in body.splitlines() if line.startswith("**教材来源：**")), "")
                location = f"chapters/{chapter.name}:{text.count(chr(10), 0, heading.start()) + 1}"
                paragraphs = body.split("\n\n", 2)
                summary = paragraphs[1] if len(paragraphs) > 1 else body
                matches.append((score, location, title, summary, page))
    return sorted(matches, key=lambda item: (-item[0], item[1]))


def main():
    parser = argparse.ArgumentParser(description="检索数据结构复习技能中的章节知识。")
    parser.add_argument("query", help="关键词，可用空格连接，如 KMP nextval")
    parser.add_argument("--limit", type=int, default=3, choices=range(1, 11), metavar="1-10")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    chapter_dir = Path(__file__).resolve().parents[1] / "chapters"
    if not chapter_dir.is_dir():
        parser.error("请运行技能目录中的 scripts/search.py")
    matches = search(chapter_dir, args.query)
    if not matches:
        print("没有找到匹配的主题。可试用较短关键词或查看章节索引。")
        return
    for _, location, title, summary, page in matches[:args.limit]:
        print(f"{location}  {title}\n{summary}\n{page}\n")


if __name__ == "__main__":
    main()
