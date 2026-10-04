from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import Point, shape
from shapely.ops import unary_union


RESOLUTIONS_KM = {"COARSE": 3.0, "MEDIUM": 2.0, "FINE": 1.0}
REGIONS = {
    "KONKAN": {"Mumbai", "Mumbai Suburban", "Raigarh", "Ratnagiri", "Sindhudurg", "Thane"},
    "WESTERN_MAHARASHTRA": {"Pune", "Kolhapur", "Sangli", "Satara", "Solapur"},
    "NORTH_MAHARASHTRA": {"Dhule", "Jalgaon", "Nandurbar", "Nashik", "Ahmadnagar"},
    "MARATHWADA": {"Aurangabad", "Bid", "Hingoli", "Jalna", "Latur", "Nanded", "Osmanabad", "Parbhani"},
    "VIDARBHA": {"Akola", "Amravati", "Bhandara", "Buldana", "Chandrapur", "Garhchiroli", "Gondiya", "Nagpur", "Wardha", "Washim", "Yavatmal"},
}


class MaharashtraDomain:
    def __init__(self, resolution: str = "COARSE", buffer_km: float = 0) -> None:
        if resolution not in RESOLUTIONS_KM:
            raise ValueError(f"Unknown analysis resolution: {resolution}")
        path = Path(__file__).parents[1] / "data" / "geography" / "maharashtra-districts.json"
        collection = json.loads(path.read_text(encoding="utf-8"))
        self.resolution_name = resolution
        self.resolution_km = RESOLUTIONS_KM[resolution]
        self.buffer_km = buffer_km
        self.state_feature = next(feature for feature in collection["features"] if feature["properties"]["kind"] == "state")
        self.district_features = [feature for feature in collection["features"] if feature["properties"]["kind"] == "district"]
        self.state_geometry = shape(self.state_feature["geometry"])
        self.district_geometries = [(feature, shape(feature["geometry"])) for feature in self.district_features]
        self.analysis_geometry = self.state_geometry.buffer(buffer_km / 111)
        west, south, east, north = self.analysis_geometry.bounds
        self.bounds = {"west": west, "south": south, "east": east, "north": north}
        self.grid_width, self.grid_height, self.grid_mask = self._build_grid_mask()

    def _build_grid_mask(self) -> tuple[int, int, np.ndarray]:
        mid_latitude = (self.bounds["north"] + self.bounds["south"]) / 2
        lat_step = self.resolution_km / 111
        lon_step = self.resolution_km / (111 * max(math.cos(math.radians(mid_latitude)), 0.1))
        longitudes = np.arange(self.bounds["west"], self.bounds["east"] + lon_step, lon_step)
        latitudes = np.arange(self.bounds["south"], self.bounds["north"] + lat_step, lat_step)
        try:
            from shapely import contains_xy

            longitude_grid, latitude_grid = np.meshgrid(longitudes, latitudes)
            mask = contains_xy(self.analysis_geometry, longitude_grid, latitude_grid)
        except ImportError:
            mask = np.array([[self.analysis_geometry.contains(Point(longitude, latitude)) for longitude in longitudes] for latitude in latitudes])
        return len(longitudes), len(latitudes), mask

    @property
    def inside_grid_cells(self) -> int:
        return int(self.grid_mask.sum())

    def district_for_point(self, longitude: float, latitude: float) -> dict[str, Any] | None:
        point = Point(longitude, latitude)
        for feature, geometry in self.district_geometries:
            if geometry.contains(point) or geometry.touches(point):
                return feature["properties"]
        return None

    def districts_for_footprint(self, longitude: float, latitude: float, radius_km: float) -> list[dict[str, Any]]:
        footprint = Point(longitude, latitude).buffer(max(radius_km, 1) / 111)
        return [feature["properties"] for feature, geometry in self.district_geometries if geometry.intersects(footprint)]

    def region_for_district(self, district_name: str) -> str:
        for region, districts in REGIONS.items():
            if district_name in districts:
                return region
        return "CENTRAL"

    def state_polygon(self) -> dict[str, Any]:
        return self.state_feature["geometry"]

    def metadata(self) -> dict[str, Any]:
        return {
            "name": "Maharashtra",
            "state": "Maharashtra",
            "crs": "EPSG:4326",
            "bounds": self.bounds,
            "bufferKm": self.buffer_km,
            "gridResolutionKm": self.resolution_km,
            "gridWidth": self.grid_width,
            "gridHeight": self.grid_height,
            "insideStateCells": self.inside_grid_cells,
            "districtCount": len(self.district_features),
        }

    def grid_metadata(self) -> dict[str, Any]:
        return {
            "resolutionKm": self.resolution_km,
            "width": self.grid_width,
            "height": self.grid_height,
            "insideStateCells": self.inside_grid_cells,
            "outsideStateCellsMasked": int(self.grid_mask.size - self.grid_mask.sum()),
            "mask": "Maharashtra polygon",
        }

    def domain_response(self) -> dict[str, Any]:
        return {**self.metadata(), "polygon": self.state_polygon()}


DOMAIN = MaharashtraDomain(os.getenv("ANALYSIS_RESOLUTION", "COARSE").upper())
