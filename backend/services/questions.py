from typing import Any

OTHER_SUFFIX = "_other"
NOTES_SUFFIX = "_notes"

SUBMIT_KEY = "submit"
DISMISS = {"label_key": "chat", "icon": "message-square"}

DECLINE_MARK = "declined the questions"
DECLINE_MESSAGE = (
    "The user declined the questions and wants to discuss this instead."
    " Ask them how they'd like to proceed."
)


def _options(index: int, question: dict) -> list[dict]:
    return [
        {
            "value": f"{index}_{position}",
            "label": str(option.get("label", "")),
            "description": option.get("description"),
            "preview": option.get("preview"),
        }
        for position, option in enumerate(question.get("options") or [])
        if isinstance(option, dict)
    ]


def questions_to_blocks(questions: list[dict]) -> list[dict]:
    pages: list[dict] = []
    for index, question in enumerate(questions):
        options = _options(index, question)
        elements: list[dict] = []
        text = question.get("question")
        if text:
            elements.append({"type": "text", "text": str(text)})
        elements.append({
            "type": "select",
            "id": f"q{index}",
            "multiple": bool(question.get("multiSelect")),
            "options": options,
        })
        if not any(option.get("preview") for option in options):
            elements.append({"type": "input", "id": f"q{index}{OTHER_SUFFIX}", "placeholder_key": "other"})
        elements.append({"type": "notes", "id": f"q{index}{NOTES_SUFFIX}", "placeholder_key": "notes"})
        pages.append({
            "type": "page",
            "label": question.get("header"),
            "blocks": elements,
        })
    return pages


def _selected(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    return [str(value)] if value not in (None, "") else []


def answers_from_values(questions: list[dict], values: dict) -> tuple[dict, dict]:
    answers: dict[str, Any] = {}
    annotations: dict[str, Any] = {}
    for index, question in enumerate(questions):
        picked = set(_selected(values.get(f"q{index}")))
        labels = [option["label"] for option in _options(index, question) if option["value"] in picked]
        free_text = str(values.get(f"q{index}{OTHER_SUFFIX}") or "").strip()
        if free_text:
            labels.append(free_text)
        notes = str(values.get(f"q{index}{NOTES_SUFFIX}") or "").strip()
        if not labels and not notes:
            continue
        key = str(question.get("question", ""))
        answers[key] = labels if question.get("multiSelect") else (labels[0] if labels else "")
        if notes:
            annotations[key] = {"notes": notes}
    return answers, annotations


def values_from_answers(questions: list[dict], answered: dict[str, tuple[str, str]]) -> dict:
    values: dict[str, Any] = {}
    for index, question in enumerate(questions):
        answer, note = answered.get(str(question.get("question", "")), ("", ""))
        parts = [part.strip() for part in answer.split(",") if part.strip()] if answer else []
        options = _options(index, question)
        picked = [option["value"] for option in options if option["label"] in parts]
        extra = [part for part in parts if part not in {option["label"] for option in options}]
        if picked:
            values[f"q{index}"] = picked
        if extra:
            values[f"q{index}{OTHER_SUFFIX}"] = ", ".join(extra)
        if note:
            values[f"q{index}{NOTES_SUFFIX}"] = note
    return values
