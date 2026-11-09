"""
Resume normalisation and hashing.
The same CV pasted with different line breaks or spacing should give the same hash, 
so a saved summary is reused and not regenerated: 

- Normalise resume text by collapsing runs of whitespace into one space and trimming both ends.
- The hash is the SHA-256 hex digest of the normalised text, encoded as UTF-8.
- Case is kept, so "Ann" and "ann" hash differently.
- The hash is computed from `resume_text` when needed. It is not stored on the candidate.
- Hashing does not reject empty text. The API and the database reject empty resumes.

"""

import hashlib
import re


def normalise_resume(text: str) -> str:
    """Collapse runs of whitespace into one space and trim both ends."""
    return re.sub(r"\s+", " ", text).strip()


def resume_hash(text: str) -> str:
    """SHA-256 hex digest of the normalised text."""
    return hashlib.sha256(normalise_resume(text).encode("utf-8")).hexdigest()
