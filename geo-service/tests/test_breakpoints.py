from breakpoints import find_break_points


def test_find_break_points():
    break_points = find_break_points(
        legs=[{
            'durationSeconds': 36000,
            'coordinates': [[0, 0], [10, 0]]
        }],
        max_driving_seconds=14400
    )

    assert break_points == [
        {
            'legIndex': 0,
            'location': (4.0, 0.0),
            'cumulativeSeconds': 14400
        },
        {
            'legIndex': 0,
            'location': (8.0, 0.0),
            'cumulativeSeconds': 28800
        }
    ]


def test_break_points_reset_at_each_leg():
    break_points = find_break_points(
        legs=[
            {'durationSeconds': 18_000, 'coordinates': [[0, 0], [10, 0]]},
            {'durationSeconds': 7_200, 'coordinates': [[10, 0], [20, 0]]},
        ],
        max_driving_seconds=14_400,
    )

    assert len(break_points) == 1
    assert break_points[0]['legIndex'] == 0
    assert break_points[0]['cumulativeSeconds'] == 14_400


def test_exact_limit_and_shorter_legs_have_no_break_points():
    legs = [
        {'durationSeconds': 14_400, 'coordinates': [[0, 0], [10, 0]]},
        {'durationSeconds': 14_399.4, 'coordinates': [[0, 0], [10, 0]]},
    ]

    assert find_break_points(legs, 14_400) == []


def test_degenerate_leg_has_no_break_points():
    legs = [{'durationSeconds': 28_800, 'coordinates': [[1, 1], [1, 1]]}]

    assert find_break_points(legs, 14_400) == []