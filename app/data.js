/* Strong & Steady: exercise, routine, journey and badge data.
   Exercises follow the NHS "Strength and flexibility exercises" pages (sitting, strength, balance, flexibility).
   Items marked src:"adapted" are gentle seated versions written for people who exercise sitting down. */

/* plan types:
   alt  = alternate sides each rep (e.g. left knee, right knee); reps = per side
   each = do all reps on one side, then the other; reps = per side
   once = no sides
   hold = seconds to hold each rep (0 = a steady counted movement)
   pace = seconds per rep for counted movements
   sets = number of sets at full level (level 1 does 1 set) */
window.EX = {
  /* ----- NHS sitting exercises ----- */
  "chest-stretch": {name:"Chest stretch", pos:"sit", src:"NHS sitting exercises",
    why:"Good for posture.",
    steps:["Sit upright, away from the back of the chair.","Pull your shoulders back and down. Stretch your arms out to the sides.","Gently push your chest forward and up until you feel a stretch across your chest."],
    plan:{type:"once", reps:5, hold:5}},
  "twist": {name:"Upper-body twist", pos:"sit", src:"NHS sitting exercises",
    why:"Keeps your upper back flexible.",
    steps:["Sit upright with your feet flat on the floor.","Cross your arms and reach for your shoulders.","Keeping your hips still, turn your upper body as far as is comfortable. Hold, then turn back."],
    plan:{type:"alt", reps:5, hold:5, labels:["to the left","to the right"]}},
  "hip-march": {name:"Hip marching", pos:"sit", src:"NHS sitting exercises",
    why:"Strengthens your hips and thighs.",
    steps:["Sit upright, not leaning on the back of the chair. Hold the sides of the chair.","Lift one knee, keeping it bent, as far as is comfortable.","Lower your foot back down with control, then lift the other leg."],
    plan:{type:"alt", reps:5, hold:0, pace:3, labels:["left knee","right knee"]}},
  "ankle": {name:"Ankle stretch", pos:"sit", src:"NHS sitting exercises",
    why:"Keeps ankles flexible and helps your circulation.",
    steps:["Sit upright, holding the side of the chair.","Straighten one leg with your foot off the floor.","With your leg straight and raised, point your toes away from you, then back towards you."],
    plan:{type:"each", reps:5, hold:0, pace:3, sets:2, labels:["left foot","right foot"]}},
  "neck-rot": {name:"Neck rotation", pos:"sit", src:"NHS sitting and flexibility exercises",
    why:"Keeps your neck moving freely.",
    steps:["Sit upright with your shoulders down. Look straight ahead.","Slowly turn your head towards one shoulder, as far as is comfortable.","Hold, then turn back to the front."],
    plan:{type:"alt", reps:3, hold:5, labels:["to the left","to the right"]}},
  "neck-stretch": {name:"Neck stretch", pos:"sit", src:"NHS flexibility exercises",
    why:"Loosens tight neck muscles.",
    steps:["Sit upright and look straight ahead.","Hold one shoulder down with the opposite hand.","Slowly tilt your head away from the shoulder you're holding. Hold, then come back up."],
    plan:{type:"alt", reps:3, hold:5, labels:["tilt to the right","tilt to the left"]}},
  "seated-curls": {name:"Arm curls (seated)", pos:"sit", src:"NHS strength exercises (can be done sitting)",
    why:"Strengthens your arms for lifting and carrying.",
    steps:["Sit upright holding something light in each hand. Filled water bottles are fine.","Keep your upper arms by your sides.","Slowly bend your elbows until the weights reach your shoulders, then slowly lower them."],
    plan:{type:"alt", reps:5, hold:0, pace:4, sets:3, labels:["left arm","right arm"]}},
  /* ----- seated adaptations ----- */
  "seated-leg": {name:"Leg straightening (seated)", pos:"sit", src:"adapted",
    why:"Strengthens the front of your thighs, for standing and climbing stairs.",
    steps:["Sit upright and hold the sides of the chair.","Slowly straighten one knee, lifting your foot as far as is comfortable.","Hold, then lower your foot slowly to the floor."],
    plan:{type:"alt", reps:5, hold:3, labels:["left leg","right leg"]}},
  "seated-heel-toe": {name:"Heel and toe raises (seated)", pos:"sit", src:"adapted",
    why:"Strengthens your calves and shins, which helps your walking.",
    steps:["Sit upright with both feet flat on the floor.","Lift both heels, keeping your toes on the floor, then lower them.","Next time, lift your toes, keeping your heels on the floor."],
    plan:{type:"alt", reps:5, hold:0, pace:3, labels:["heels up","toes up"]}},
  "seated-side": {name:"Side bend (seated)", pos:"sit", src:"adapted from NHS sideways bend",
    why:"Keeps your lower back flexible.",
    steps:["Sit upright with your arms by your sides.","Slide one hand down towards the floor, as far as is comfortable.","Hold, then sit back up."],
    plan:{type:"alt", reps:3, hold:2, labels:["to the left","to the right"]}},
  /* ----- NHS strength exercises ----- */
  "sit-stand": {name:"Sit-to-stand", pos:"chair-front", src:"NHS strength exercises",
    why:"Builds the strength you use every time you get up.",
    steps:["Sit on the front of the chair, feet hip-width apart, leaning slightly forward.","Stand up slowly using your legs, not your arms. Look forward, not down.","Lower yourself slowly back down. Use your hands only to guide you if needed."],
    plan:{type:"once", reps:5, hold:0, pace:6}},
  "mini-squat": {name:"Mini-squats", pos:"chair-back", src:"NHS strength exercises",
    why:"Strengthens your legs and bottom.",
    steps:["Stand with feet hip-width apart, hands resting on the back of a chair.","Slowly bend your knees as far as is comfortable, keeping your back straight and knees over your big toes.","Rise slowly, squeezing your bottom as you come up."],
    plan:{type:"once", reps:5, hold:0, pace:5}},
  "calf-raise": {name:"Calf raises", pos:"chair-back", src:"NHS strength exercises",
    why:"Strengthens your calves, which helps your balance.",
    steps:["Stand with your hands resting on the back of a chair.","Slowly lift both heels off the floor, as far as is comfortable.","Lower your heels back down with control."],
    plan:{type:"once", reps:5, hold:0, pace:4}},
  "side-leg": {name:"Sideways leg lift", pos:"chair-back", src:"NHS strength exercises",
    why:"Strengthens your hips, which helps you stay steady.",
    steps:["Stand with your hands resting on the back of a chair.","Lift one leg out to the side, as far as is comfortable. Keep your back and hips straight; don't lean.","Lower it, then lift the other leg."],
    plan:{type:"alt", reps:5, hold:0, pace:4, labels:["right leg","left leg"]}},
  "leg-ext": {name:"Leg extension", pos:"chair-back", src:"NHS strength exercises",
    why:"Works the back of your thighs and your bottom.",
    steps:["Stand upright, hands resting on the back of a chair.","Keeping one leg straight, lift it backwards. Don't arch your back.","Hold, then lower it."],
    plan:{type:"alt", reps:5, hold:5, labels:["left leg","right leg"]}},
  "wall-press": {name:"Wall press-up", pos:"wall", src:"NHS strength exercises",
    why:"Strengthens your arms, shoulders and chest.",
    steps:["Stand an arm's length from a wall. Put your hands flat on it at chest height, fingers up.","Keeping your back straight, slowly bend your arms, elbows close to your sides, bringing your body towards the wall.","Slowly push back to the start."],
    plan:{type:"once", reps:5, hold:0, pace:5, sets:3}},
  "curls": {name:"Arm curls", pos:"stand", src:"NHS strength exercises",
    why:"Strengthens your arms for lifting and carrying.",
    steps:["Stand with feet hip-width apart, holding something light in each hand (filled water bottles are fine).","Keep your upper arms by your sides.","Slowly bend your elbows until the weights reach your shoulders, then slowly lower them."],
    plan:{type:"alt", reps:5, hold:0, pace:4, sets:3, labels:["left arm","right arm"]}},
  /* ----- NHS balance exercises ----- */
  "side-walk": {name:"Sideways walking", pos:"wall", src:"NHS balance exercises",
    why:"Improves your balance and hip strength.",
    steps:["Stand with feet together and knees slightly bent, near a wall or worktop.","Step sideways slowly and under control, then bring the other foot to join it.","Keep your hips level as you step."],
    plan:{type:"each", reps:10, hold:0, pace:3, labels:["stepping to the right","stepping back to the left"], unit:"step"}},
  "grapevine": {name:"Simple grapevine", pos:"wall", src:"NHS balance exercises",
    why:"Challenges your balance in a safe, controlled way.",
    steps:["Stand near a wall. You can rest your fingers on it.","Cross one foot over the other, then bring the back foot out to join it.","Keep going sideways, crossing one foot over the other."],
    plan:{type:"each", reps:5, hold:0, pace:4, labels:["moving to the left","moving to the right"], unit:"cross-step"}},
  "heel-toe": {name:"Heel-to-toe walk", pos:"wall", src:"NHS balance exercises",
    why:"Helps you walk more steadily.",
    steps:["Stand upright beside a wall. You can rest your fingers on it.","Put one heel directly in front of the other foot's toes.","Then put the other heel in front of the first foot's toes. Look forward, not down."],
    plan:{type:"once", reps:5, hold:0, pace:4, unit:"step"}},
  "one-leg": {name:"One-leg stand", pos:"wall-face", src:"NHS balance exercises",
    why:"One of the best ways to stay steady on your feet.",
    steps:["Stand facing a wall with your arms out and your fingertips touching it.","Lift one foot, keeping your hips level and a slight bend in your standing knee.","Hold, then gently put your foot back down."],
    plan:{type:"each", reps:3, hold:5, holdMax:10, labels:["standing on your right leg","standing on your left leg"]}},
  "step-up": {name:"Step-up", pos:"step", src:"NHS balance exercises",
    why:"Builds strength and balance for stairs and kerbs.",
    steps:["Stand facing the bottom stair, with a hand on the rail.","Step up with one leg, then bring the other up to join it.","Step back down one leg at a time, slowly and with control."],
    plan:{type:"each", reps:5, hold:0, pace:5, labels:["leading with your right leg","leading with your left leg"]}},
  /* ----- NHS flexibility exercises ----- */
  "side-bend": {name:"Sideways bend", pos:"stand", src:"NHS flexibility exercises",
    why:"Keeps your lower back flexible.",
    steps:["Stand upright, feet hip-width apart, arms by your sides.","Slide one arm down the side of your leg as far as is comfortable. You'll feel a stretch in the opposite hip.","Hold, then come back up."],
    plan:{type:"alt", reps:3, hold:2, labels:["to the left","to the right"]}},
  "calf-stretch": {name:"Calf stretch", pos:"wall-face", src:"NHS flexibility exercises",
    why:"Loosens tight calf muscles.",
    steps:["Put your hands against a wall.","Bend your front knee and step the other leg back at least a foot's length, keeping it straight.","Keep both feet flat and your back heel on the floor. Feel the stretch in your back calf."],
    plan:{type:"each", reps:3, hold:10, labels:["left calf","right calf"]}}
};

/* Seated-only swaps for standing exercises (null = left out) */
window.SEATED = {"sit-stand":"seated-leg","mini-squat":"hip-march","calf-raise":"seated-heel-toe","side-leg":null,"leg-ext":null,
  "wall-press":null,"curls":"seated-curls","side-bend":"seated-side","calf-stretch":"ankle",
  "side-walk":null,"grapevine":null,"heel-toe":null,"one-leg":null,"step-up":null};

/* stars: strength / steady (balance & flexibility). "move" comes from steps or a logged walk. */
window.ROUTINES = [
  {id:"strength", name:"Strength", blurb:"Legs, arms and getting up from a chair.", stars:["strength"], color:"teal",
    list:["sit-stand","mini-squat","calf-raise","side-leg","leg-ext","wall-press","curls"]},
  {id:"balance", name:"Balance", blurb:"Steadier on your feet. Done standing near a wall.", stars:["steady"], standingOnly:true,
    list:["side-walk","grapevine","heel-toe","one-leg","step-up"]},
  {id:"chair", name:"Chair exercises", blurb:"A gentle all-round session, all done sitting down.", stars:["strength"],
    list:["chest-stretch","twist","hip-march","ankle","neck-rot","seated-curls"]},
  {id:"flex", name:"Stretch", blurb:"Loosen up your neck, back and legs.", stars:["steady"],
    list:["neck-rot","neck-stretch","side-bend","calf-stretch"]},
  {id:"mix", name:"Quick mix", blurb:"A bit of everything: strength, balance and a stretch.", stars:["strength","steady"],
    list:["chest-stretch","sit-stand","calf-raise","heel-toe","one-leg","calf-stretch"]},
  {id:"gentle", name:"Gentle few minutes", blurb:"For when you're not at your best. Ankles and neck only.", stars:[], hidden:true,
    list:["ankle","neck-rot"]}
];

/* Journey: Hadrian's Wall Path, east to west. 84 miles (National Trails).
   Mileages are approximate, from the six standard stages (15, 15.5, 12, 16.25, 11, 14.75 miles). */
window.JOURNEYS = [{
  id:"hadrian", name:"Hadrian's Wall Path", miles:84, from:"Wallsend", to:"Bowness-on-Solway",
  stops:[
    {mi:0, name:"Segedunum, Wallsend", fact:"Your walk starts at the Roman fort that guarded the eastern end of the Wall. Building began around AD 122, on the orders of Emperor Hadrian."},
    {mi:4, name:"Newcastle Quayside", fact:"The path follows the Tyne past its famous bridges. The Tyne Bridge opened in 1928."},
    {mi:15, name:"Heddon-on-the-Wall", fact:"End of the first stage, and the first stretch of the Wall itself that you can see on the walk west."},
    {mi:30.5, name:"Chesters Roman Fort, Chollerford", fact:"A cavalry fort beside the North Tyne, with one of the best-preserved Roman bath houses in Britain."},
    {mi:38.5, name:"Housesteads Roman Fort", fact:"The Romans called it Vercovicium. It sits high on a ridge and is famous for its well-preserved latrines."},
    {mi:41.5, name:"Sycamore Gap", fact:"The dip in the Wall where the famous sycamore stood until it was cut down in 2023. Seedlings from it have been planted around the country."},
    {mi:43.5, name:"Winshields Crags", fact:"The highest point of the whole path, at 345 metres. On a clear day you can see the Solway Firth."},
    {mi:49, name:"Walltown Crags", fact:"Some of the highest-standing sections of the Wall, snaking along the crags."},
    {mi:54, name:"Birdoswald Roman Fort", fact:"The fort the Romans called Banna, beside the longest continuous surviving stretch of the Wall."},
    {mi:70, name:"Carlisle", fact:"The great border city, with its medieval castle and cathedral. Nearly there: about 14 miles to go."},
    {mi:84, name:"Bowness-on-Solway", fact:"The end of the Wall and of your walk: 84 miles, coast to coast across England. The Romans had a fort here called Maia."}
  ]}];
window.STEPS_PER_MILE = 2400;     /* a typical shorter stride */
window.SESSION_MILES = 0.5;       /* bonus distance for each session done */
window.WALK_MIN_PER_MILE = 25;    /* for walks logged by hand */

window.RANKS = [[0,"Starter"],[60,"Stepper"],[180,"Walker"],[400,"Rambler"],[750,"Hiker"],[1200,"Trailblazer"],[1800,"Pathfinder"],[2600,"Fell walker"],[3600,"Mountaineer"],[5000,"Legend"]];

window.BADGES = [
  {id:"first", icon:"🌱", name:"First steps", desc:"Your first session done."},
  {id:"three", icon:"⭐", name:"Full set", desc:"All three stars in one day."},
  {id:"s3", icon:"🔥", name:"On a roll", desc:"3 days in a row."},
  {id:"s7", icon:"🏅", name:"One whole week", desc:"7 days in a row."},
  {id:"s14", icon:"🎖️", name:"Fortnight", desc:"14 days in a row."},
  {id:"s30", icon:"🏆", name:"A month strong", desc:"30 days in a row."},
  {id:"s60", icon:"💎", name:"Two months", desc:"60 days in a row."},
  {id:"s100", icon:"👑", name:"The 100 club", desc:"100 days in a row."},
  {id:"nhs", icon:"✅", name:"NHS target met", desc:"Strength and balance on 2 days in one week."},
  {id:"week3", icon:"🌟", name:"Star week", desc:"At least 14 stars in one week."},
  {id:"level", icon:"📈", name:"Moving up", desc:"Moved a routine up a level."},
  {id:"top", icon:"🚀", name:"Top level", desc:"Reached level 3 in a routine."},
  {id:"steady", icon:"🦩", name:"Steady Eddie", desc:"Held a one-leg stand for 10 seconds in a check-up."},
  {id:"checkup", icon:"📋", name:"Check-up done", desc:"Your first fitness check-up."},
  {id:"pb", icon:"💪", name:"Personal best", desc:"Beat your best in a check-up."},
  {id:"comeback", icon:"🌈", name:"Comeback", desc:"Back exercising after being unwell."},
  {id:"steps5k", icon:"👟", name:"5,000 steps", desc:"5,000 steps in a day."},
  {id:"steps8k", icon:"🥾", name:"8,000 steps", desc:"8,000 steps in a day."},
  {id:"halfway", icon:"🗺️", name:"Halfway", desc:"Halfway along your journey."},
  {id:"journey", icon:"🏁", name:"Journey's end", desc:"Finished a whole journey."},
  {id:"variety", icon:"🎨", name:"All-rounder", desc:"Tried every kind of routine."},
  {id:"s200", icon:"🏔️", name:"Unstoppable", desc:"200 days in a row."}
];

window.TREATS_DAILY = ["a G&T tonight","a cup of tea and a biscuit","a slice of cake","a cream tea","a pint at the pub","a glass of wine tonight","a sit down with the paper","an episode of your favourite programme"];
window.TREATS_BIG = ["fish and chips","a meal out","a trip to the garden centre","a new book","a takeaway","a bunch of flowers"];
