import sys, json, cv2
from ultralytics import YOLO
img = cv2.imread(sys.argv[1]); zone = json.load(open('zone.json'))
model = YOLO('yolov8n.pt')
res = model.predict(img, classes=[0], conf=0.35, imgsz=960, verbose=False)[0]
poly = zone['chair']
import numpy as np
pts = np.array(poly, np.int32)
cv2.polylines(img, [pts], True, (0,215,255), 4)
inside=0
for b in res.boxes:
    x1,y1,x2,y2 = map(int, b.xyxy[0]); cx,cy=(x1+x2)//2,(y1+y2)//2
    ins = cv2.pointPolygonTest(pts,(float(cx),float(cy)),False)>=0
    inside += ins
    cv2.rectangle(img,(x1,y1),(x2,y2),(0,255,0) if ins else (0,0,255),3)
    cv2.putText(img,f"pessoa {float(b.conf[0]):.2f} {'NA CADEIRA' if ins else 'fora'}",(x1,max(30,y1-10)),cv2.FONT_HERSHEY_SIMPLEX,1.0,(0,255,0) if ins else (0,0,255),2)
print(f"pessoas detectadas: {len(res.boxes)} | na cadeira: {inside}")
cv2.imwrite(sys.argv[2], img)
