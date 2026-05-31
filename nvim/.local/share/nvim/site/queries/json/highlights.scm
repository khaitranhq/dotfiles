(pair
  key: (_) @label)

(pair
  value: (string) @string)

(array
  (string) @string)

(number) @number

[
  (true)
  (false)
] @boolean

(null) @constant.builtin

(escape_sequence) @string.escape

(comment) @comment
