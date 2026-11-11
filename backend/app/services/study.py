from __future__ import annotations

import json
import logging
import os

import anthropic

from app.models.schemas import StudyGenerateRequest, StudySetOut

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-opus-5-5"

SYSTEM_PROMPT = """Du lager øvingsmateriale for en student som skal opp til eksamen.
Du får pensumtekst (forelesninger, leksjoner, øvinger) på norsk. Lag materiale på norsk bokmål
som hjelper studenten å forstå og huske stoffet, ikke bare gjengi det.

- Flashcards: ett begrep, en formel eller ett faktum per kort. Forsiden er et konkret spørsmål,
  baksiden et kort, presist svar (1–3 setninger). Ta med formler og regneregler der de finnes.
- Quiz: flervalg med nøyaktig 4 alternativer og ett riktig svar. Feilalternativene skal være
  troverdige misforståelser. Ta med regneoppgaver når pensum har beregninger. Forklaringen sier
  hvorfor riktig svar er riktig.
- Gjenkalling: åpne spørsmål der studenten forklarer et tema med egne ord. key_points er
  punktene et godt svar må dekke.
- section er tittelen på kapitlet i pensumteksten materialet kommer fra (bruk eksakt tittel).
- Bygg kun på pensumteksten. Ikke finn på tall, definisjoner eller fakta som ikke står der."""

STUDY_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "flashcards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "front": {"type": "string"},
                    "back": {"type": "string"},
                    "section": {"type": "string"},
                },
                "required": ["front", "back", "section"],
                "additionalProperties": False,
            },
        },
        "quiz": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "answer_index": {"type": "integer"},
                    "explanation": {"type": "string"},
                    "section": {"type": "string"},
                },
                "required": [
                    "question",
                    "options",
                    "answer_index",
                    "explanation",
                    "section",
                ],
                "additionalProperties": False,
            },
        },
        "recall": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "key_points": {"type": "array", "items": {"type": "string"}},
                    "section": {"type": "string"},
                },
                "required": ["prompt", "key_points", "section"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "flashcards", "quiz", "recall"],
    "additionalProperties": False,
}


class StudyGenerationError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def study_model() -> str:
    # Read lazily: backend/.env is loaded after this module is imported
    return os.getenv("STUDY_MODEL") or DEFAULT_MODEL


def study_ready() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


def _build_user_prompt(request: StudyGenerateRequest) -> str:
    parts = [f"<emne>{request.subject}</emne>" if request.subject else ""]
    parts.append(f'<dokument tittel="{request.title}">')
    for section in request.sections:
        parts.append(f'<kapittel tittel="{section.title}">\n{section.text}\n</kapittel>')
    parts.append("</dokument>")
    parts.append(
        f"Lag omtrent {request.flashcards} flashcards, {request.quiz} quizspørsmål "
        f"og {request.recall} gjenkallingsspørsmål, fordelt over kapitlene etter hvor "
        "mye viktig stoff de har. Lag færre hvis teksten er for kort til å fylle dem "
        "med godt innhold. summary er 2–4 setninger om hva dokumentet dekker."
    )
    if request.focus:
        parts.append(f"Studenten ønsker særlig fokus på: {request.focus}")
    return "\n\n".join(p for p in parts if p)


def generate_study_set(request: StudyGenerateRequest) -> StudySetOut:
    if not study_ready():
        raise StudyGenerationError(
            "ANTHROPIC_API_KEY mangler. Legg den i backend/.env og start backend på nytt.",
            status_code=503,
        )

    client = anthropic.Anthropic()
    try:
        with client.beta.messages.stream(
            model=study_model(),
            max_tokens=64000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_user_prompt(request)}],
            output_config={
                "effort": "medium",
                "format": {"type": "json_schema", "schema": STUDY_SCHEMA},
            },
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        ) as stream:
            message = stream.get_final_message()
    except anthropic.AuthenticationError as exc:
        raise StudyGenerationError("Ugyldig API-nøkkel", status_code=401) from exc
    except anthropic.RateLimitError as exc:
        raise StudyGenerationError(
            "For mange forespørsler mot Claude. Prøv igjen om litt.", status_code=429
        ) from exc
    except anthropic.APIStatusError as exc:
        raise StudyGenerationError(f"Claude-feil ({exc.status_code}): {exc.message}") from exc
    except anthropic.APIConnectionError as exc:
        raise StudyGenerationError("Fikk ikke kontakt med Claude. Sjekk nettet.") from exc

    if message.stop_reason == "refusal":
        raise StudyGenerationError("Claude avslo å lage materiale for denne teksten.")
    if message.stop_reason == "max_tokens":
        raise StudyGenerationError(
            "Svaret ble for langt. Prøv med færre kort/spørsmål eller et mindre dokument."
        )

    text = next((b.text for b in message.content if b.type == "text"), None)
    if not text:
        raise StudyGenerationError("Claude returnerte ikke noe innhold")

    logger.info(
        "Study set for %r: %s in / %s out tokens",
        request.title,
        message.usage.input_tokens,
        message.usage.output_tokens,
    )
    study_set = StudySetOut.model_validate(json.loads(text))
    # Drop malformed quiz items rather than failing the whole set
    study_set.quiz = [
        q for q in study_set.quiz if len(q.options) >= 2 and 0 <= q.answer_index < len(q.options)
    ]
    study_set.model = message.model
    return study_set
