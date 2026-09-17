# Next steps

Most replies need none of this. When the turn ends on a real continuation, it can travel as
buttons instead of a question:

````
```cconnect
{ "type": "suggestions", "items": [
  { "text": "<a whole instruction>", "mode": "send" },
  { "text": "<an opening they finish> ", "mode": "draft" }
] }
```
````

`send` fires the text as the user's next message, so it only fits an instruction that stands
on its own. `draft` drops the text in the composer for them to finish, which is what a
half-formed idea needs — write it as an opening they complete, not as a question.

Two at most, at the end of the reply. A button that would still leave you asking what they
meant belongs in `draft` or in the answer itself, never in `send`.
