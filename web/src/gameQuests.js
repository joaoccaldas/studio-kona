// Kona Race-Week Campaign & Memory Quest Engine
export const RACE_WEEK_QUESTS = [
  {
    id: 'day1',
    dayNumber: 1,
    title: 'Arrival & Kamakahonu Acclimatization',
    subtitle: 'Sunday · Race Week Begins',
    description: 'Arrive in Kailua-Kona, acclimatize in the sacred bay, and uncover the courage that put Kona on the global map.',
    startHour: 7.25,
    cameraStart: 'transition',
    steps: [
      {
        id: 'day1_pier',
        text: 'Walk to Kailua Pier entrance',
        target: [2, 8],
        radius: 14,
        beaconColor: 0xffcc33,
        note: 'The heartbeat of Kona race week. Where champions rack their machines.'
      },
      {
        id: 'day1_swim',
        text: 'Shakeout swim in Kamakahonu Bay',
        target: [-30, -22],
        radius: 16,
        beaconColor: 0x33bbff,
        note: 'Sacred waters of King Kamehameha I. The historic morning swim location.'
      },
      {
        id: 'day1_echo',
        text: 'Discover Memory Echo 1982: The Crawl',
        target: [48, -55],
        radius: 12,
        isEcho: true,
        echoYear: '1982',
        echoAthlete: 'Julie Moss & Kathleen McCartney',
        beaconColor: 0xff4488,
        artifact: {
          id: 'vintage_steel_1982',
          type: 'bike',
          name: '1982 Vintage Steel Road Bike & Bib #185',
          athlete: 'Julie Moss / Early Era Pioneers',
          year: '1982',
          split: '11:10:09 (Epic Finish)',
          modelFile: 'speedmax_2027_cfr.glb',
          specs: {
            frame: 'Lugged Columbus SL Steel Tube',
            drivetrain: 'Campagnolo Super Record 6-speed down-tube shifters',
            wheels: '36-spoke box rims with cotton tubulars',
            weight: '10.8 kg',
            innovation: 'Friction shifting, leather toe-clips and dual water bottles'
          },
          story: 'In February 1982, college student Julie Moss collapsed 15 feet from the finish line, crawling on hands and knees. Broadcast live by ABC Wide World of Sports, her sheer courage ignited the modern global triathlon movement.',
          portalUrl: 'https://triatlas.com/champions/julie-moss'
        }
      }
    ]
  },
  {
    id: 'day2',
    dayNumber: 2,
    title: 'Queen K Aero Reconnaissance',
    subtitle: 'Tuesday · The Lava Fields',
    description: 'Scout the brutal Queen Kaʻahumanu Highway and experience the legendary 1989 Iron War duel.',
    startHour: 9.0,
    cameraStart: 'finish',
    steps: [
      {
        id: 'day2_palani',
        text: 'Climb Palani Road towards the Queen K',
        target: [120, 25],
        radius: 20,
        beaconColor: 0xff8833,
        note: 'The infamous Palani hill: the test that kicks off the 112-mile bike course.'
      },
      {
        id: 'day2_crosswinds',
        text: 'Reach Queen K Highway crosswind sector',
        target: [280, 50],
        radius: 28,
        beaconColor: 0xffaa00,
        note: 'Hoʻomumuku crosswinds gusting down from Kohala volcano.'
      },
      {
        id: 'day2_echo',
        text: 'Discover Memory Echo 1989: The Iron War',
        target: [219, 8],
        radius: 16,
        isEcho: true,
        echoYear: '1989',
        echoAthlete: 'Mark Allen vs Dave Scott',
        beaconColor: 0xff3344,
        artifact: {
          id: 'iron_war_bike_1989',
          type: 'bike',
          name: '1989 Centurion / Huffy Iron War Special',
          athlete: 'Dave Scott & Mark Allen',
          year: '1989',
          split: '8:09:15 Course Record',
          modelFile: 'trek_equinox_2004.glb',
          specs: {
            frame: 'Custom TIG-Welded Prestige Cromo / Aluminum Hybrid',
            drivetrain: 'Shimano Dura-Ace 7400 7-Speed SIS',
            aerobars: 'Original Scott DH Aerodynamic Clip-on Extensions',
            weight: '9.4 kg',
            innovation: 'The aerodynamic handlebar revolution that transformed long-distance pacing'
          },
          story: 'The most ferocious duel in endurance sports. Mark Allen and 6-time champion Dave Scott ran shoulder-to-shoulder for 139 miles in scorching heat. Allen surged on the hill climbing out of the Energy Lab to claim his first crown in 8:09:15.',
          portalUrl: 'https://triatlas.com/champions/mark-allen'
        }
      }
    ]
  },
  {
    id: 'day3',
    dayNumber: 3,
    title: 'Kailua Bay & The Coffee Boat',
    subtitle: 'Wednesday · Open Water Tradition',
    description: 'Swim out into the deep blue Pacific to the legendary floating AG1 Live Aloha Coffee Boat.',
    startHour: 7.5,
    cameraStart: 'start',
    steps: [
      {
        id: 'day3_bay',
        text: 'Swim past the Dig Me Beach reef',
        target: [60, -90],
        radius: 22,
        beaconColor: 0x33ccff,
        note: 'Crystal clear Pacific waters. Sea turtles (Honu) swimming below.'
      },
      {
        id: 'day3_coffee',
        text: 'Reach the floating Coffee Boat',
        target: [120, -180],
        radius: 18,
        beaconColor: 0xffcc44,
        note: 'An espresso in the middle of the ocean — Kona’s most joyful tradition.'
      },
      {
        id: 'day3_echo',
        text: 'Discover Memory Echo 2023: Wire-to-Wire Record',
        target: [160, -220],
        radius: 16,
        isEcho: true,
        echoYear: '2023',
        echoAthlete: 'Lucy Charles-Barclay',
        beaconColor: 0x00e5ff,
        artifact: {
          id: 'lucy_goggles_2023',
          type: 'gear',
          name: '2023 Lucy Charles-Barclay Swim Goggles & Speed Platform',
          athlete: 'Lucy Charles-Barclay',
          year: '2023',
          split: '8:24:31 Course Record',
          modelFile: 'speedmax_2027_cfr.glb',
          specs: {
            swimSplit: '49:36 (Fastest Pro Female Swim)',
            bikeSplit: '4:32:29',
            runSplit: '2:57:38',
            gear: 'Polarized Hydro-Dynamic Goggles & Custom Aerodynamic Tri-Suit',
            innovation: 'Flawless front-running wire-to-wire race strategy'
          },
          story: 'After four painful runner-up finishes, Lucy Charles-Barclay stormed off Dig Me Beach, established an unassailable lead on the swim, and set a historic course record of 8:24:31 without ever relinquishing first place.',
          portalUrl: 'https://triatlas.com/champions/lucy-charles-barclay'
        }
      }
    ]
  },
  {
    id: 'day4',
    dayNumber: 4,
    title: 'Underpants Run & Village Expo',
    subtitle: 'Thursday · The Festival of Kona',
    description: 'Join the world-famous Underpants Run along Aliʻi Drive and discover the 8-hour barrier breakthrough.',
    startHour: 7.75,
    cameraStart: 'finish',
    steps: [
      {
        id: 'day4_underpants',
        text: 'Run the festive Underpants Run on Aliʻi Drive',
        target: [320, -90],
        radius: 35,
        beaconColor: 0xff66cc,
        note: 'Thousands of athletes and fans running in swimsuits for local charity.'
      },
      {
        id: 'day4_village',
        text: 'Visit IRONMAN Village at Hale Hālāwai',
        target: [219, 8],
        radius: 20,
        beaconColor: 0x44dd88,
        note: 'Cutting edge triathlon tech, nutrition bars, and athlete briefings.'
      },
      {
        id: 'day4_echo',
        text: 'Discover Memory Echo 2018: Sub-8 Barrier Broken',
        target: [160, -40],
        radius: 16,
        isEcho: true,
        echoYear: '2018',
        echoAthlete: 'Patrick Lange',
        beaconColor: 0xffaa00,
        artifact: {
          id: 'lange_shoes_2018',
          type: 'gear',
          name: '2018 Patrick Lange Sub-8 Racing Shoes',
          athlete: 'Patrick Lange',
          year: '2018',
          split: '7:52:39 (First Sub-8 in Kona History)',
          modelFile: 'speedmax_2019_slx.glb',
          specs: {
            marathonSplit: '2:41:27 (Course Run Record)',
            shoeType: 'Custom lightweight carbon racing flat',
            cadence: '188 spm average across 42.2 km',
            milestone: 'Sub-8 hour barrier shattered for the first time on the island'
          },
          story: 'Germany’s Patrick Lange etched his name in sports immortality by breaking the mythical 8-hour barrier in Kona with a 7:52:39 masterstroke, punctuated by proposing to his fiancée at the finish line.',
          portalUrl: 'https://triatlas.com/champions/patrick-lange'
        }
      }
    ]
  },
  {
    id: 'day5',
    dayNumber: 5,
    title: 'Transition Check-In on Kailua Pier',
    subtitle: 'Friday · Eve of Battle',
    description: 'Roll your superbike through the transition arch on Kailua Pier and inspect Jan Frodeno’s 2019 Course Record machine.',
    startHour: 13.0,
    cameraStart: 'transition',
    steps: [
      {
        id: 'day5_pier_gate',
        text: 'Enter the transition gate on Kailua Pier',
        target: [-18, 30],
        radius: 14,
        beaconColor: 0x3388ff,
        note: 'Blue carpet, bike racks, and gear bags racked under Hawaiian palms.'
      },
      {
        id: 'day5_rack',
        text: 'Rack your machine in Row 1',
        target: [0, 10],
        radius: 12,
        beaconColor: 0xffcc00,
        note: 'Number plate verified, tires pumped, nutrition bottles mounted.'
      },
      {
        id: 'day5_echo',
        text: 'Discover Memory Echo 2019: Frodeno’s Canyon Speedmax',
        target: [12, 6],
        radius: 10,
        isEcho: true,
        echoYear: '2019',
        echoAthlete: 'Jan Frodeno',
        beaconColor: 0xff0044,
        artifact: {
          id: 'frodeno_speedmax_2019',
          type: 'bike',
          name: 'Jan Frodeno’s 2019 Canyon Speedmax CF SLX',
          athlete: 'Jan Frodeno',
          year: '2019',
          split: '7:51:13 World Championship Record',
          modelFile: 'speedmax_2019_slx.glb',
          specs: {
            frame: 'Canyon Speedmax CF SLX Carbon with Aero Aeroshield',
            groupset: 'SRAM Red eTap AXS Wireless / 50-37T chainrings with 10-33T',
            cockpit: 'Custom Ergonomic Carbon 3D Mono-extension cockpit with integrated straw',
            wheels: 'DT Swiss ARC 1100 Dicut 85mm Rear / 85mm Front Carbon',
            tires: 'Continental Grand Prix 5000 TT TR (28mm rear, 25mm front)',
            weight: '9.1 kg race setup'
          },
          story: 'Jan Frodeno put together the most complete athletic performance ever seen in triathlon: a 47:31 swim, 4:16:03 bike split on this very Canyon Speedmax, and a 2:42:21 marathon to establish an immortal 7:51:13 course record.',
          portalUrl: 'https://triatlas.com/champions/jan-frodeno'
        }
      }
    ]
  },
  {
    id: 'day6',
    dayNumber: 6,
    title: 'The World Championship Race Day',
    subtitle: 'Saturday 10 Oct 2026 · Cannon Blast',
    description: 'The cannon fires at 06:25 HST. Conquer the bay, the lava, and the finish line on Aliʻi Drive.',
    startHour: 6.4,
    cameraStart: 'start',
    steps: [
      {
        id: 'day6_cannon',
        text: 'Stand at Dig Me Beach for the 06:25 cannon blast',
        target: [48, -55],
        radius: 18,
        beaconColor: 0xff4400,
        note: 'The heartbeat of 2,500 athletes waiting for the deep-water boom.'
      },
      {
        id: 'day6_turn',
        text: 'Reach the Turn Boats at 1,840m',
        target: [631, -1778],
        radius: 45,
        beaconColor: 0xffcc00,
        note: 'Body Glove and Jack’s Diving catamaran turnaround point.'
      },
      {
        id: 'day6_finish',
        text: 'Cross the finish line on Aliʻi Drive: YOU ARE AN IRONMAN!',
        target: [160, -40],
        radius: 16,
        isEcho: true,
        echoYear: '2026',
        echoAthlete: 'World Champion',
        beaconColor: 0xffd700,
        artifact: {
          id: 'kona_championship_wreath',
          type: 'trophy',
          name: 'Kona Finisher Ti-Leaf & Orchid Laurel Wreath',
          athlete: 'Kona Finisher',
          year: '2026',
          split: 'Official Finisher',
          modelFile: 'speedmax_2027_cfr.glb',
          specs: {
            title: 'Kona World Championship Finisher',
            swim: '3.8 km Kailua Bay',
            bike: '180.2 km Queen K Highway & Hāwī',
            run: '42.2 km Energy Lab & Aliʻi Drive',
            status: 'Permanently immortalized in the Kona Hall'
          },
          story: '“Anything is possible.” You have experienced the wind, heat, history, and machines that have forged the greatest endurance test on earth. Welcome home.',
          portalUrl: 'https://triatlas.com/history'
        }
      }
    ]
  }
];

const STORAGE_KEY = 'kona.game.save.v1';

export function loadGameSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return {
    currentDayIndex: 0,
    currentStepIndex: 0,
    completedDays: [],
    unlockedArtifacts: [],
    discoveredMemories: []
  };
}

export function saveGameProgress(saveData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  } catch (e) {}
}
