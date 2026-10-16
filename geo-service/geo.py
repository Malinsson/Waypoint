
EARTH_RADIUS_METERS = 6_371_008.8

def haversine_meters(first_point, second_point):
    
    """
    Calculate the great-circle distance between two points on the Earth surface.

    :param first_point: The first point as (longitude, latitude)
    :param second_point: The second point as (longitude, latitude)
    :return: Distance in meters
    """
    from math import radians, sin, cos, sqrt, atan2

    # Convert decimal degrees to radians
    lon1, lat1 = radians(first_point[0]), radians(first_point[1])
    lon2, lat2 = radians(second_point[0]), radians(second_point[1])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    
    return EARTH_RADIUS_METERS * c


def cumulative_distances(coordinates):
    """
    Calculate cumulative distances between a list of coordinates.

    :param coordinates: List of tuples containing (longitude, latitude)
    :return: List of cumulative distances in meters
    """
    cumulative = [0.0]
    for i in range(1, len(coordinates)):
        distance = haversine_meters(coordinates[i - 1], coordinates[i])
        cumulative.append(cumulative[-1] + distance)
    return cumulative


def point_at_distance(coordinates, cumulative, target):
    """
    Find the point at a specific distance along a path defined by coordinates.

    :param coordinates: List of tuples containing (longitude, latitude)
    :param cumulative: List of cumulative distances in meters
    :param target: Target distance in meters
    :return: Tuple containing (longitude, latitude) of the point at the target distance
    """
    if target < 0 or target > cumulative[-1]:
        raise ValueError("Target distance is out of bounds.")

    for i in range(1, len(cumulative)):
        if cumulative[i] >= target:
            # Interpolate between coordinates[i-1] and coordinates[i]
            ratio = (target - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1])
            lon = coordinates[i - 1][0] + ratio * (coordinates[i][0] - coordinates[i - 1][0])
            lat = coordinates[i - 1][1] + ratio * (coordinates[i][1] - coordinates[i - 1][1])
            return (lon, lat)
    
    return coordinates[-1]  # Return the last coordinate if target is exactly at the end
 