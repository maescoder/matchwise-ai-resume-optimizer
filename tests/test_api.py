import unittest

from fastapi.testclient import TestClient

from main import app


class MatchwiseApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_health_and_frontend(self) -> None:
        health = self.client.get("/api/health")
        homepage = self.client.get("/")

        self.assertEqual(health.status_code, 200)
        self.assertTrue(health.json()["ok"])
        self.assertEqual(homepage.status_code, 200)
        self.assertIn("Matchwise", homepage.text)

    def test_python_ats_score_contract(self) -> None:
        response = self.client.post(
            "/api/score",
            json={
                "jobDescription": "Python AWS SQL communication",
                "currentResume": (
                    "Sanjay Pandey\nSkills: Python, AWS, SQL\nProjects\n"
                    "Built a Python API used by 100 users."
                ),
            },
        )

        self.assertEqual(response.status_code, 200)
        analysis = response.json()["analysis"]
        self.assertGreaterEqual(analysis["score"], 0)
        self.assertLessEqual(analysis["score"], 100)
        self.assertIn("heatmap", analysis)

    def test_text_resume_upload(self) -> None:
        response = self.client.post(
            "/api/extract-resume",
            files={"resume": ("resume.txt", b"Sanjay Pandey\nPython Developer", "text/plain")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("Python Developer", response.json()["text"])


if __name__ == "__main__":
    unittest.main()
