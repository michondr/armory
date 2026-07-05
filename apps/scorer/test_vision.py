import unittest

from vision import _ring_value


class RingValueTest(unittest.TestCase):
    def test_center_is_max(self):
        self.assertEqual(_ring_value(0, 100, 10), 10)

    def test_midpoint(self):
        # dist 50 of radius 100, ring width 10 -> 10 - floor(50/10) = 5
        self.assertEqual(_ring_value(50, 100, 10), 5)

    def test_near_edge_is_low(self):
        self.assertEqual(_ring_value(95, 100, 10), 1)

    def test_at_or_beyond_radius_is_zero(self):
        self.assertEqual(_ring_value(100, 100, 10), 0)
        self.assertEqual(_ring_value(150, 100, 10), 0)

    def test_zero_radius_is_zero(self):
        self.assertEqual(_ring_value(0, 0, 10), 0)


if __name__ == "__main__":
    unittest.main()
