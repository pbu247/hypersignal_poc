import csv
import random
from pathlib import Path

def generate_dummy_data_csv(
    output_path: str = "dummy_weather_10M.csv",
    n_rows: int = 10_000_000,
):
    """
    대용량 더미 데이터 CSV 생성 (스트리밍 방식)
    - 온도, 습도, 기압 등 + 연/월/일/시 컬럼
    """

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    header = [
        "id",
        "year",
        "month",
        "day",
        "hour",
        "temperature_c",
        "humidity_pct",
        "pressure_hpa",
        "device_id",
        "region",
    ]

    regions = ["north", "south", "east", "west"]
    device_count = 100  # device_0001 ~ device_0100

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)

        for i in range(1, n_rows + 1):
            year = random.randint(2018, 2024)
            month = random.randint(1, 12)
            day = random.randint(1, 28)
            hour = random.randint(0, 23)

            temperature_c = round(random.uniform(-20.0, 40.0), 2)
            humidity_pct = round(random.uniform(0.0, 100.0), 2)
            pressure_hpa = round(random.uniform(950.0, 1050.0), 2)

            device_id = f"device_{i % device_count + 1:04d}"
            region = random.choice(regions)

            row = [
                i,
                year,
                month,
                day,
                hour,
                temperature_c,
                humidity_pct,
                pressure_hpa,
                device_id,
                region,
            ]

            writer.writerow(row)

            if i % 1_000_000 == 0:
                print(f"{i:,} rows generated...")

    print(f"완료! 파일 위치: {output_path.resolve()}")


if __name__ == "__main__":
    generate_dummy_data_csv(
        output_path="dummy_weather_10M.csv",
        n_rows=10_000_000,
    )