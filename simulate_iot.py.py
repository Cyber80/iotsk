import requests
import json
import random
import time

#SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxxx/exec"  # แทนด้วยของคุณเอง
SCRIPT_URL ="https://script.google.com/macros/s/AKfycbz-jy0pXomTTM1ghVaQAF_ukVGpBbY0Xn29xauKlzTHJYg39ifpyBOOZikbmdvxpN58/exec"

while True:
    data = {
        "soil": random.randint(800, 3000),   # จำลองค่าความชื้นในดิน
        "light": random.randint(100, 2000),  # จำลองค่าความสว่าง
        "pump": random.choice([0, 1]),
        "lamp": random.choice([0, 1])
    }

    try:
        res = requests.post(SCRIPT_URL, json=data)
        print("ส่งข้อมูลแล้ว:", data, "| สถานะ:", res.text)
    except Exception as e:
        print("Error:", e)

    time.sleep(10)  # ส่งข้อมูลทุก 10 วินาที
