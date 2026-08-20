from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from scripts.validate_docs import validate_repository


class ValidateDocsTests(unittest.TestCase):
    def test_accepts_valid_relative_link(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "target.md").write_text("# Target\n", encoding="utf-8")
            (root / "index.md").write_text("[Target](target.md)\n", encoding="utf-8")

            self.assertEqual(validate_repository(root), [])

    def test_reports_broken_relative_link(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.md").write_text("[Missing](missing.md)\n", encoding="utf-8")

            findings = validate_repository(root)

            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0].line, 1)
            self.assertIn("broken relative link", findings[0].message)

    def test_reports_empty_document_and_trailing_whitespace(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "empty.md").write_text("   \n", encoding="utf-8")

            messages = [finding.message for finding in validate_repository(root)]

            self.assertIn("document is empty", messages)
            self.assertIn("trailing whitespace", messages)

    def test_rejects_link_outside_repository(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.md").write_text("[Outside](../outside.md)\n", encoding="utf-8")

            findings = validate_repository(root)

            self.assertEqual(len(findings), 1)
            self.assertIn("link leaves repository", findings[0].message)


if __name__ == "__main__":
    unittest.main()
