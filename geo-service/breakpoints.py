from geo import cumulative_distances, point_at_distance


def find_break_points(legs, max_driving_seconds):
    """Find break points after each full driving-limit interval in each leg."""
    break_points = []

    for leg_index, leg in enumerate(legs):
        duration = round(leg["durationSeconds"])
        if duration <= max_driving_seconds:
            continue

        cumulative = cumulative_distances(leg["coordinates"])
        line_length = cumulative[-1]
        if line_length == 0:
            continue

        interval = 1
        while interval * max_driving_seconds < duration:
            cumulative_seconds = interval * max_driving_seconds
            fraction = cumulative_seconds / duration
            location = point_at_distance(
                leg["coordinates"],
                cumulative,
                fraction * line_length,
            )
            break_points.append(
                {
                    "legIndex": leg_index,
                    "location": location,
                    "cumulativeSeconds": cumulative_seconds,
                }
            )
            interval += 1

    return break_points