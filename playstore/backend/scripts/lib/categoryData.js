// scripts/lib/categoryData.js
//
// Shared between seedCategories.js and seedApps.js so both scripts agree
// on the same category list and app-name banks.

// Category.name is capped at 20 chars (model validation) - every entry
// here fits that.
export const CATEGORIES = [
    "Productivity",
    "Games",
    "Photography",
    "Finance",
    "Education",
    "Health & Fitness",
    "Music",
    "Social",
    "Utilities",
    "Developer Tools",
    "Tools",
    "Video",
    "Shopping",
    "News",
    "Travel",
    "Weather",
    "Sports",
    "Food & Drink",
    "Lifestyle",
    "Business",
    "Kids",
    "Books",
];

// Meaningful, category-appropriate app names - not trademarks of any real
// product, just plain descriptive names for what that kind of app does.
export const APP_NAMES_BY_CATEGORY = {
    "Productivity": ["TaskFlow", "PlanWell", "FocusList", "DailyStack", "NoteKeeper", "QuickTasks", "TimeBlock", "ToDoNow"],
    "Games": ["PixelQuest", "PuzzleDash", "TowerLeap", "BlockMatch", "StarRunner", "MazeHopper", "CardClash", "GridJump"],
    "Photography": ["PhotoVault", "SnapEditor", "LensCraft", "PicPolish", "FrameKeeper", "ShotStudio", "PhotoTidy", "ClickBook"],
    "Finance": ["BudgetWise", "ExpenseTrack", "CoinLedger", "SpendSmart", "SavingsPath", "MoneyMap", "BillWatch", "CashNotes"],
    "Education": ["StudyBuddy", "WordDrill", "MathSprint", "LearnLoop", "QuizMaster", "FlashDeck", "LessonLog", "ClassNotes"],
    "Health & Fitness": ["StepCounter", "PulseTrack", "FitJourney", "CalmBreath", "WorkoutLog", "SleepChart", "HydrateMe", "MoveDaily"],
    "Music": ["BeatMixer", "TuneBox", "SoundStudio", "PlaylistPro", "RhythmPad", "ChordFinder", "TrackNotes", "AudioLoop"],
    "Social": ["ChatCircle", "FriendFeed", "MeetSpace", "GroupPing", "ConnectHub", "EventCircle", "TalkBoard", "NearbyChat"],
    "Utilities": ["FileKeeper", "QuickScan", "BatteryGuard", "CleanCache", "UnitConvert", "FlashTool", "NoteScan", "QRReader"],
    "Developer Tools": ["CodeSnip", "APITester", "GitPanel", "LogViewer", "BuildTrack", "JSONFormat", "RegexLab", "DevNotes"],
    "Tools": ["MeasureIt", "QuickCalc", "HandyKit", "ToolBox", "LevelCheck", "TapeMeasure", "FlashLightPro", "CompassView"],
    "Video": ["ClipEditor", "VidTrim", "ScenePlay", "StreamCast", "MovieMaker", "ReelCut", "FrameTrim", "VideoNotes"],
    "Shopping": ["CartTrack", "DealFinder", "PriceWatch", "ListShop", "BargainHub", "WishListPro", "CouponBox", "ShopNotes"],
    "News": ["DailyBrief", "NewsPulse", "HeadlineNow", "StoryFeed", "PressPoint", "TopicTrack", "ReadLater", "NewsDigest"],
    "Travel": ["TripPlanner", "MapGuide", "JourneyLog", "PackList", "RoutePath", "TravelNotes", "FlightWatch", "CityGuide"],
    "Weather": ["SkyForecast", "StormAlert", "WeatherNow", "ClimateView", "RainTracker", "SunTimes", "WindCheck", "FrostAlert"],
    "Sports": ["ScoreBoard", "MatchTracker", "TeamStats", "FitLeague", "GameDay", "LeagueLog", "PlayerCard", "MatchNotes"],
    "Food & Drink": ["RecipeBox", "MealPlan", "CookNotes", "TasteLog", "KitchenHelper", "PantryTrack", "DinnerIdeas", "BrewLog"],
    "Lifestyle": ["DailyRitual", "HabitTrack", "MindfulDay", "SimpleLife", "MorningFlow", "EveningWind", "GoalKeeper", "JournalDay"],
    "Business": ["InvoiceEasy", "TeamBoard", "MeetingLog", "ClientTrack", "TaskAssign", "LeadNotes", "ProjectPath", "TimeSheet"],
    "Kids": ["LearnPlay", "StoryTime", "ABCFun", "KidsDraw", "PuzzleKids", "ShapeMatch", "CountPlay", "ColorBook"],
    "Books": ["ReadList", "BookNotes", "PageTurner", "StoryShelf", "LibraryLog", "ChapterMark", "ReadingLog", "BookShelf"],
};

export async function ensureCategories(Category) {
    const rows = [];
    for (const name of CATEGORIES) {
        const [category, created] = await Category.findOrCreate({ where: { name } });
        rows.push({ category, created });
    }
    return rows;
}
