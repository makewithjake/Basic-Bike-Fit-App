# Cycl3D Bike Fit App – Roadmap and vision board

# High Priority - Next Sprint
- **Data Verification** - update angles to match recomendations from bike fit book.
- **Demo Photo Update** - Update Demo photo to include Jake using ROCKER FEET!!! 
- **Bike type selector** – add Road / Gravel dropdown; each type carries its own ideal angle ranges (MTB upright geometry differs from road aero)
- **Better Magnification** - currently, uses blue circle to locate point. consider adding magnifying glass/loupe to desktop version as well as mobile?
- **Move Mag Glass** - move mag glass to lower right corner of image for all plateforms will always be easy to see.
- **Add Theory and Sources Link** - Button opens up window with some basic fit theory and info, plus links to applicable books (amazon affiliate?)


## Idea List
- **Sources and References** - Include a sources and references window so users can continue further research
- **Custom Angle Range** - All user a "custom" option where they can input specific angle ranges for custom fit. Maybe they want to copy the fit of an old bike to a new bike, or already have an idea of how they want the fit to look.
- **Heel Dot** - add a heel dot, move "toe" dot to the cleat location.  Allows better estimation of foot angle and cleat position impact.
- **Adjustment Slider** - offer an adjustment slider for various contact points. ie seat position, use slider to move hip joint up or down, which in turn affects the knee and back angles. Will need to "lock" the length/distance between points when doing this. Adjustment sliders: Seat (hip points)(up/down), Bar (hand point)(up/down), Stem (hand point)(shorter/longer), Crank (cleat position)(Shorter/longer), Seat (hip point)(forward/back)
- **Default Point Cloud** - add points automatically.  User can then just click and drag as needed, might be easier to understand the workflow.  This could be a button as well.  Populate Points (Generic)

- **Help Window** - open help window on load, or immediately after uploading photo?  Easy way to "force" user to read it and understand the process before continuing
- **Triathalon Fit** - Add angles and/or fit rec for tri bikes. 

## Pie in the Sky List
- **Adjustment recommendations** – upgrade vague advice ("RAISE saddle height") to specific, actionable guidance (e.g. "Raise saddle ~5–10 mm") and tailor advice per bike type
- **Save Points** - output a "save" code that user can copy/paste into the app to populate points based on the locations from the code. Could be more usful than current save feature
- **Overlay** - overlay multiple bike fit sessions
- **Mobile App** - IOS/Android mobile app
- **Video Analysis** - there are free google made apps that can be used to identify human features and pivot points. could be a good way to do video analysis
- **Fit Theory** - Road/Gravel fit vs RAD fit. Drop down selector if alternate style is desired. RAD would require completely different point cloud since it measures length and not necessarily angle
- **Walk Through** - Have a video or animation play to "guide" the user on first load. Would want a button to show it again, but also store some data locally so that it ONLY plays the first time the app is loaded.
- **Front View Analysis** - Photo from the front would allow analysis of the shoulder vs bar width. drop angles, etc.
- **Flexibility Analysis** - Photo or video of user performing certain actions so we can analize and make a decision on how to increase flexibility/what to focus on

## Where Ideas go to die - Items that Im not going to implement but dont want to forget

## Completed Items (removed from plan.md)
- [x] Session save / restore (localStorage)
- [x] Demo image loader
- [x] Help modal
- [x] Photo upload (FileReader → base64 → `<img>`)
- [x] Click-to-place + drag joint markers (7 points: Toe → Ankle → Knee → Hip → Shoulder → Elbow → Hand)
- [x] Angle calculations: Knee, Back, Shoulder, Elbow, Ankle
- [x] Riding style selector: Relaxed / Balanced / Aggressive
- [x] Results table – measured angle, ideal range, corrective advice
- [x] Added Notes fields