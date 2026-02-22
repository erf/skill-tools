---
name: count-words
description: Count words in text using the count_words tool.
---

# Count Words

A minimal example of a Skill Tool. This skill bundles a `count_words` tool that counts the number of words in a text string.

## Usage

Call the `count_words` tool with a `text` parameter:

```
count_words({ text: "The quick brown fox jumps over the lazy dog" })
```

Returns:

```json
{ "count": 9 }
```
