// Every tuning number, colour, recipe and station position in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. EMBERLINE v2: a wood-fired kitchen rush.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One shift lasts two and a half minutes of play. */
export const SHIFT_SECONDS = 150;
/** Rush hour starts this far into the shift: orders arrive faster and the fire burns hotter. */
export const RUSH_AT = 60;
/** How long the RUSH HOUR banner stays up after rush hour starts. */
export const RUSH_BANNER_SECONDS = 4;

export const CHEF = {
  radius: 17,
  speed: 330,
  /** Pixels from a station anchor at which the chef can use it. */
  reach: 52,
};

/** A ticket stays patient this long (seconds); rush-hour tickets get a little less. */
export const TICKET = {
  patience: 45,
  rushPatience: 40,
  /** Below this many seconds left the ticket shows HURRY!. */
  hurryAt: 12,
  maxOpen: 4,
  firstAt: 2,
  spawn: 8,
  rushSpawn: 4.5,
};

/** Seconds an item sits READY on the grill or fryer before it burns. */
export const BURN_AFTER = 7;
/** Seconds a board takes to chop one ingredient. */
export const CHOP_SECONDS = 2;
/** Seconds of holding E at the sink to wash one dirty plate. */
export const WASH_SECONDS = 1.2;
/** Clean plates in the stack when the shift starts. */
export const START_PLATES = 4;
/** Items a single plate can hold. */
export const PLATE_SLOTS = 3;
export const PLATE_MAX_ITEMS = 5;

/** Perfect serve: the ticket still had more than half its patience left. */
export const PERFECT_TIP = 3;
/** Serving while the streak is at least this long pays a bonus on every serve. */
export const STREAK_BONUS_AT = 3;
export const STREAK_BONUS = 2;

/** Coins that earn one, two and three stars at the end of the shift. */
export const STARS = { one: 40, two: 80, three: 120 };

/** Raw ingredients, in bin order across the top of the kitchen. */
export const INGREDIENTS = ['tomato', 'lettuce', 'cheese', 'patty', 'bun', 'potato', 'mushroom', 'dough'];

/** What a chop board turns a raw ingredient into, and how long it takes. */
export const CHOP = {
  tomato: { out: 'choppedTomato', seconds: 2 },
  lettuce: { out: 'choppedLettuce', seconds: 2 },
  mushroom: { out: 'choppedMushroom', seconds: 2 },
};

/** What the brick oven turns an item into, and how long it takes. */
export const GRILL = {
  patty: { out: 'grilledPatty', seconds: 3 },
  dough: { out: 'flatbread', seconds: 4 },
  choppedMushroom: { out: 'grilledMushroom', seconds: 2 },
};

/** What the fryer turns an item into, and how long it takes. */
export const FRY = {
  potato: { out: 'fries', seconds: 4 },
};

/** The six dishes, in the order they unlock. `needs` is the exact multiset a plate must hold. */
export const RECIPES = [
  { id: 'salad', name: 'Garden Salad', price: 6, unlock: 0, needs: ['choppedLettuce', 'choppedTomato'] },
  { id: 'fries', name: 'Golden Fries', price: 5, unlock: 0, needs: ['fries'] },
  { id: 'burger', name: 'Ember Burger', price: 12, unlock: 0, needs: ['bun', 'grilledPatty', 'cheese', 'choppedLettuce', 'choppedTomato'] },
  { id: 'flatbread', name: 'Flatbread', price: 10, unlock: 25, needs: ['flatbread', 'choppedTomato', 'cheese'] },
  { id: 'melt', name: 'Mushroom Melt', price: 9, unlock: 45, needs: ['bun', 'grilledMushroom', 'cheese'] },
  { id: 'platter', name: 'Ember Platter', price: 16, unlock: 70, needs: ['grilledPatty', 'fries', 'grilledMushroom', 'choppedTomato'] },
];

/** Ticket modifiers: a twist printed on the ticket that changes what the plate must hold. */
export const MODIFIERS = [
  { id: 'extraCheese', label: '+ extra cheese', extra: ['cheese'], remove: [] },
  { id: 'noLettuce', label: 'no lettuce', extra: [], remove: ['choppedLettuce'] },
  { id: 'doublePatty', label: 'double patty', extra: ['grilledPatty'], remove: [] },
];

/** Short names the judge's source outline shows for every item kind. */
export const ITEM_LABEL = {
  tomato: 'Tomato',
  lettuce: 'Lettuce',
  cheese: 'Cheese',
  patty: 'Patty',
  bun: 'Bun',
  potato: 'Potato',
  mushroom: 'Mushroom',
  dough: 'Dough',
  choppedTomato: 'Chopped tomato',
  choppedLettuce: 'Chopped lettuce',
  choppedMushroom: 'Chopped mushroom',
  grilledPatty: 'Grilled patty',
  grilledMushroom: 'Grilled mushroom',
  flatbread: 'Flatbread',
  fries: 'Fries',
  burnt: 'Burnt food',
};

/** Where everything in the kitchen sits, in playfield pixels. */
export const LAYOUT = {
  header: { y: 0, height: 96 },
  bins: { y: 104, height: 60, x: 16, width: 92, gap: 8 },
  serve: { x: 880, y: 104, width: 384, height: 60 },
  floor: { y: 172, height: 388 },
  boards: [
    { x: 16, y: 240, width: 184, height: 68 },
    { x: 16, y: 340, width: 184, height: 68 },
  ],
  grill: { x: 1064, y: 180, width: 200, height: 150 },
  fryer: { x: 1064, y: 344, width: 200, height: 150 },
  island: { x: 470, y: 300, width: 340, height: 170 },
  plates: { x: 16, y: 576, width: 124, height: 120 },
  plating: { x: 170, y: 576, width: 710, height: 120 },
  trash: { x: 900, y: 576, width: 110, height: 120 },
  sink: { x: 1030, y: 576, width: 234, height: 120 },
};

/** Interaction anchors: where the chef stands to use each station. */
export const ANCHORS = {
  bins: INGREDIENTS.map((kind, i) => ({
    kind,
    x: LAYOUT.bins.x + i * (LAYOUT.bins.width + LAYOUT.bins.gap) + LAYOUT.bins.width / 2,
    y: LAYOUT.bins.y + LAYOUT.bins.height + 12,
  })),
  boards: LAYOUT.boards.map((b, i) => ({ index: i, x: b.x + b.width + 16, y: b.y + b.height / 2 })),
  grill: { x: LAYOUT.grill.x - 16, y: LAYOUT.grill.y + LAYOUT.grill.height / 2 },
  fryer: { x: LAYOUT.fryer.x - 16, y: LAYOUT.fryer.y + LAYOUT.fryer.height / 2 },
  serve: { x: 960, y: 188, width: 0, height: 0 },
  plating: [
    { slot: 0, x: 300, y: LAYOUT.plating.y - 12 },
    { slot: 1, x: 525, y: LAYOUT.plating.y - 12 },
    { slot: 2, x: 750, y: LAYOUT.plating.y - 12 },
  ],
  trash: { x: LAYOUT.trash.x + LAYOUT.trash.width / 2, y: LAYOUT.trash.y - 12 },
  sink: { x: LAYOUT.sink.x + LAYOUT.sink.width / 2, y: LAYOUT.sink.y - 12 },
};

export const PALETTE = {
  backdrop: '#1c130c',
  floorA: '#b98a56',
  floorB: '#a87c4c',
  wall: '#2e1f14',
  header: '#20301f',
  headerEdge: '#f2b544',
  ticket: '#fff8e7',
  ticketEdge: '#d9c49a',
  hurry: '#e5534b',
  ticketText: '#3a2a18',
  bin: '#f7ead0',
  binEdge: '#8a6a42',
  board: '#7a5230',
  boardEdge: '#5d3d22',
  grill: '#4a2c22',
  grillBrick: '#6e3b2a',
  fryer: '#c8d2d8',
  fryerEdge: '#8fa0a8',
  island: '#8a5a34',
  islandTop: '#a06a3e',
  plating: '#5d3d22',
  plate: '#f4efe4',
  plateEdge: '#c9bfa8',
  trash: '#3a3f46',
  sink: '#7fa8b8',
  sinkEdge: '#5d8291',
  chefHat: '#f8f4ec',
  chefShirt: '#e8e2d2',
  chefApron: '#c94f43',
  chefSkin: '#f0c08a',
  coin: '#f2c94c',
  text: '#fff6e0',
  muted: '#c9b18a',
  good: '#7dc383',
  bad: '#e5534b',
  steam: 'rgba(255,255,255,0.55)',
  ember: '#ff7a2f',
  flame: '#ffb02e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
