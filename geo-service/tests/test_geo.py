import math

import pytest

from geo import cumulative_distances, haversine_meters, point_at_distance


def test_haversine_meters_returns_distance_in_meters():
    distance = haversine_meters([0, 0], [1, 0])

    assert math.isclose(distance, 111_195, rel_tol=0.001)


def test_cumulative_distances_returns_distance_from_path_start():
    coordinates = [(0, 0), (1, 0), (2, 0)]
    cumulative = cumulative_distances(coordinates)
    expected_cumulative = [0.0, 111_195.0, 222_390.0]

    assert all(
        math.isclose(actual, expected, rel_tol=0.001)
        for actual, expected in zip(cumulative, expected_cumulative)
    )


def test_point_at_distance_interpolates_along_path():
    coordinates = [(0, 0), (1, 0), (2, 0)]
    cumulative = cumulative_distances(coordinates)

    point = point_at_distance(coordinates, cumulative, 111_195.0)

    assert math.isclose(point[0], 1.0, rel_tol=0.001)
    assert math.isclose(point[1], 0.0, abs_tol=0.001)

def test_point_at_distance_0_returns_first_coordinate():
    coordinates = [(0, 0), (1, 0), (2, 0)]
    cumulative = cumulative_distances(coordinates)

    point = point_at_distance(coordinates, cumulative, 0.0)

    assert math.isclose(point[0], 0.0, rel_tol=0.001)
    assert math.isclose(point[1], 0.0, abs_tol=0.001)

def test_point_at_distance_beyond_last_returns_last_coordinate():
    coordinates = [(0, 0), (1, 0), (2, 0)]
    cumulative = cumulative_distances(coordinates)

    with pytest.raises(ValueError):
        point_at_distance(coordinates, cumulative, 300_000.0)

def test_repeat_coordinates_in_path():
    coordinates = [(0, 0), (0, 0), (1, 0)]
    cumulative = cumulative_distances(coordinates)

    point = point_at_distance(coordinates, cumulative, 55_597.5)

    assert math.isclose(point[0], 0.5, rel_tol=0.001)
    assert math.isclose(point[1], 0.0, abs_tol=0.001)

def test_point_outside_path_range():
    coordinates = [(0, 0), (1, 0), (2, 0)]
    cumulative = cumulative_distances(coordinates)

    with pytest.raises(ValueError):
        point_at_distance(coordinates, cumulative, -10.0)

    with pytest.raises(ValueError):
        point_at_distance(coordinates, cumulative, 300_000.0)