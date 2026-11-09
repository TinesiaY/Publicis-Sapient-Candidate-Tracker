"""One definition of 'blank' text, used by both the API checks and the database checks.

Text is blank when it is empty after removing these ASCII whitespace characters:
space, tab, carriage return, line feed, form feed and vertical tab.
"""

BLANK_CHARACTERS = " \t\r\n\f\v"


def is_blank(value: str) -> bool:
    return value.strip(BLANK_CHARACTERS) == ""


def has_nul(value: str) -> bool:
    return "\x00" in value


def not_blank_sql(column: str) -> str:
    """SQL condition that is true when the column is not blank, using the same characters as is_blank."""
    codes = ", ".join(str(ord(char)) for char in BLANK_CHARACTERS)
    return f"length(trim({column}, char({codes}))) > 0"
