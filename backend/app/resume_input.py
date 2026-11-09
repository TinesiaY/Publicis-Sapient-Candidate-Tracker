"""Resume input: pasted text or one uploaded .txt or .md file. Exactly one of the two is accepted."""

from fastapi import HTTPException, UploadFile

from app.text_rules import BLANK_CHARACTERS, has_nul, is_blank

MAX_RESUME_BYTES = 500 * 1024
ALLOWED_EXTENSIONS = (".txt", ".md")
SIZE_MESSAGE = f"The resume must be {MAX_RESUME_BYTES // 1024} KB or smaller"


def _read_file(upload: UploadFile) -> str:
    if not (upload.filename or "").lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=422, detail="Upload a .txt or .md file")

    # Read one byte past the limit, so an oversized file is detected without reading all of it.
    raw = upload.file.read(MAX_RESUME_BYTES + 1)
    if len(raw) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=413, detail=SIZE_MESSAGE)

    try:
        # utf-8-sig removes a byte-order mark if the file has one.
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=422, detail="The file must be UTF-8 text") from error
    if has_nul(text):
        raise HTTPException(status_code=422, detail="The file must be plain text")
    return text


def _check_pasted(text: str) -> str:
    if len(text.encode("utf-8")) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=413, detail=SIZE_MESSAGE)
    if has_nul(text):
        raise HTTPException(status_code=422, detail="The resume must be plain text")
    return text


def resolve_resume(pasted: str | None, upload: UploadFile | None) -> str:
    """Return the resume text to store. Exactly one of pasted text or a file must be given.

    A browser sends an empty text field when a file is chosen, so blank text counts as not given.
    """
    has_text = pasted is not None and not is_blank(pasted)
    has_file = upload is not None and bool(upload.filename)

    if has_text and has_file:
        raise HTTPException(status_code=422, detail="Paste the resume or upload a file, not both")
    if has_file:
        text = _read_file(upload)
    elif has_text:
        text = _check_pasted(pasted)
    else:
        raise HTTPException(status_code=422, detail="Paste the resume or upload a file")

    text = text.strip(BLANK_CHARACTERS)
    if is_blank(text):
        raise HTTPException(status_code=422, detail="The resume must not be blank")
    return text
