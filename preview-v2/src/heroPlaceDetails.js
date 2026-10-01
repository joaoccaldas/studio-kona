import * as THREE from 'three';

function box(g,mat,name,x,y,z,sx,sy,sz,evidence){
  const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
  m.name=name; m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.userData.evidence=evidence; g.add(m); return m;
}

export function addHeroVisualProfile({group:g,place:p,z,shared}){
  if(!p.visual_profile) return false;

  if(p.visual_profile==='historic_plantation_storefront'){
    const green=new THREE.MeshStandardMaterial({color:0x71866a,roughness:.9,metalness:0});
    const trim=new THREE.MeshStandardMaterial({color:0xd8d1bd,roughness:.88,metalness:0});
    box(g,green,p.id+'_historic_body',0,z+4.1,0,24,4.1,11,'official source: restored historic plantation building; form remains simplified');
    box(g,trim,p.id+'_historic_porch',0,z+1.7,-13,25,.3,3.3,'official source supports historic plantation storefront; porch depth inferred');
    for(let i=-4;i<=4;i++) box(g,trim,p.id+'_historic_post_'+(i+4),i*5.2,z+3.5,-15.5,.18,3.5,.18,'historic storefront porch rhythm inferred from building type');
    const roof=new THREE.Mesh(new THREE.CylinderGeometry(17,19,2.2,4),shared.roof);
    roof.name=p.id+'_historic_roof'; roof.rotation.y=Math.PI/4; roof.scale.set(1,.55,.72); roof.position.set(0,z+9,0);
    roof.userData.evidence='historic roof form simplified from official visual reference';
    g.add(roof);
    g.userData.visualEvidence=p.visual_evidence;
    return true;
  }

  if(p.visual_profile==='queens_marketplace_bike_shop'){
    const stucco=shared.wall||shared.shop;
    const roof=shared.roof;
    const glass=shared.glass;
    // This profile represents the shop as one bay within Queens' Marketplace, not a standalone building.
    box(g,stucco,p.id+'_marketplace_arcade',0,z+4.4,0,38,4.4,16,'official sources place Bike Works inside Queens\' Marketplace; arcade proportions are simplified');
    box(g,roof,p.id+'_marketplace_canopy',0,z+8.9,-2,40,.45,18,'resort-shopping-center canopy proxy; not surveyed facade geometry');
    box(g,glass,p.id+'_marketplace_glazing',0,z+4.1,-16.2,26,3.2,.16,'shopfront glazing proxy within marketplace bay');
    box(g,roof,p.id+'_marketplace_awning',0,z+7.2,-17.7,29,.22,2.6,'shaded storefront awning proxy');
    for(let i=-3;i<=3;i++){
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(1.0,.07,8,20),shared.service);
      wheel.name=p.id+'_display_wheel_'+(i+3);
      wheel.rotation.y=Math.PI/2;
      wheel.position.set(i*3.2,z+2.1,-17.1);
      g.add(wheel);
    }
    // Low adjacent retail wings make it read as a marketplace tenancy, not an isolated shop.
    box(g,stucco,p.id+'_marketplace_left',-35,z+3.5,4,18,3.5,14,'Queens\' Marketplace adjacency context, simplified');
    box(g,stucco,p.id+'_marketplace_right',35,z+3.5,4,18,3.5,14,'Queens\' Marketplace adjacency context, simplified');
    g.userData.visualEvidence=p.visual_evidence;
    return true;
  }

  if(p.visual_profile==='garden_courtyard_hospital'){
    const roofBlue=new THREE.MeshStandardMaterial({color:0x8da9b5,roughness:.82,metalness:0});
    const wingMat=shared.medical;
    const offsets=[[-28,0,30,8,18],[0,10,28,9,22],[30,-2,26,8,17]];
    offsets.forEach((o,i)=>{
      const [x,zz,w,h,d]=o;
      box(g,wingMat,p.id+'_courtyard_wing_'+i,x,z+h*.5,zz,w,h*.5,d,'official source confirms hospital campus; wing footprint simplified');
      box(g,roofBlue,p.id+'_blue_roof_'+i,x,z+h+.45,zz,w*1.04,.35,d*1.04,'official source: light blue roof');
    });
    const garden=new THREE.Mesh(new THREE.CircleGeometry(18,32),shared.pasture);
    garden.name=p.id+'_garden_courtyard'; garden.rotation.x=-Math.PI/2; garden.position.set(0,z+.22,-15);
    garden.userData.evidence='official source: courtyard landscaping/garden context';
    g.add(garden);
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      const shrub=new THREE.Mesh(new THREE.DodecahedronGeometry(1.2,0),shared.pasture);
      shrub.position.set(Math.cos(a)*14,z+1.1,-15+Math.sin(a)*9); shrub.scale.set(1.4,1,.9); g.add(shrub);
    }
    g.userData.visualEvidence=p.visual_evidence;
    return true;
  }

  if(p.visual_profile==='alii_finish_chute'){
    // Official IRONMAN World Championship finish line on Aliʻi Drive
    const carpetBlue=new THREE.MeshStandardMaterial({color:0x0a2240,roughness:.85});
    const carpetRed=new THREE.MeshStandardMaterial({color:0xbd1822,roughness:.8});
    const trussBlack=new THREE.MeshStandardMaterial({color:0x1e2022,roughness:.4,metalness:.8});
    const gantryRed=new THREE.MeshStandardMaterial({color:0xc01823,roughness:.4,metalness:.2});
    const scaffoldSilver=new THREE.MeshStandardMaterial({color:0xd1d5db,roughness:.3,metalness:.9});
    const bannerWhite=new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:.6});

    // 42m long blue and red carpet finish runway
    box(g,carpetBlue,p.id+'_carpet_blue',0,z+.12,0,5.2,.12,42,'official blue finish carpet corridor');
    box(g,carpetRed,p.id+'_carpet_red_center',0,z+.14,0,1.8,.12,42,'official red center finish stripe');

    // The iconic Finish Gantry Arch spanning Aliʻi Drive
    box(g,trussBlack,p.id+'_gantry_post_l',-3.6,z+3.8,0,.55,7.6,.55,'gantry left truss column');
    box(g,trussBlack,p.id+'_gantry_post_r',3.6,z+3.8,0,.55,7.6,.55,'gantry right truss column');
    box(g,trussBlack,p.id+'_gantry_top_truss',0,z+7.4,0,8.2,.65,.65,'gantry overhead cross-truss');
    // Overhead IRONMAN header board
    box(g,gantryRed,p.id+'_gantry_header',0,z+8.1,0,7.8,1.2,.28,'official IRONMAN header crown');
    // Dual digital LED race finish clocks
    box(g,trussBlack,p.id+'_race_clock_1',-1.8,z+6.8,-.25,2.4,.75,.25,'digital race finish clock 1');
    box(g,trussBlack,p.id+'_race_clock_2',1.8,z+6.8,-.25,2.4,.75,.25,'digital race finish clock 2');

    // Dual spectator grandstands / bleachers on left and right
    for(const side of [-1,1]){
      for(let tier=0;tier<4;tier++){
        box(g,scaffoldSilver,p.id+'_bleacher_'+side+'_'+tier,side*(4.5+tier*.9),z+.45+tier*.65,0,.85,.25,26,'spectator bleacher tier');
      }
      box(g,bannerWhite,p.id+'_sponsor_barricade_'+side,side*3.2,z+.65,0,.15,1.1,38,'sponsor branded crowd barricade');
    }

    // VIP announcer podium & sound tower
    box(g,scaffoldSilver,p.id+'_announcer_tower',-5.5,z+2.2,-6,3.2,4.4,3.2,'voice of IRONMAN commentary tower');
    // Medical recovery canopy tent
    box(g,bannerWhite,p.id+'_recovery_tent',0,z+2.4,-24,8.5,3.6,8.5,'athlete medical recovery tent');
    return true;
  }

  if(p.visual_profile==='kailua_pier_transition_hub'){
    // Kailua Pier T1/T2 Transition Zone
    const steelMat=shared.service;
    const blueMat=new THREE.MeshStandardMaterial({color:0x0a2240,roughness:.85});
    const tentMat=new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:.6});
    const bikeFrame=new THREE.MeshStandardMaterial({color:0xd97706,roughness:.35,metalness:.4});

    // Concrete pier staging pad
    box(g,shared.meeting,p.id+'_pier_apron',0,z+.3,0,48,.6,58,'kailua pier transition apron');

    // 4 Rows of Steel Bike Racks with hung race bikes
    for(let r=-1.5;r<=1.5;r++){
      const rz=r*11;
      box(g,steelMat,p.id+'_rack_rail_'+r,0,z+1.65,rz,36,.08,.08,'galvanized transition rack bar');
      for(let leg=-16;leg<=16;leg+=8){
        box(g,steelMat,p.id+'_rack_leg_'+r+'_'+leg,leg,z+.85,rz,.08,1.65,.08,'rack leg');
      }
      // Racked time-trial bikes
      for(let bi=-14;bi<=14;bi+=3.5){
        box(g,bikeFrame,p.id+'_bike_'+r+'_'+bi,bi,z+1.2,rz,.9,.75,.25,'racked tri super-bike');
      }
    }

    // Two large peaked Change Tents (Men and Women)
    for(const tx of [-14,14]){
      box(g,tentMat,p.id+'_change_tent_'+tx,tx,z+2.2,-18,12,4.2,14,'transition change marquee');
      const roof=new THREE.Mesh(new THREE.CylinderGeometry(.5,8.5,3.2,4),tentMat);
      roof.position.set(tx,z+5.6,-18); roof.rotation.y=Math.PI/4; g.add(roof);
    }

    // Swim exit ramp & freshwater shower archway
    box(g,blueMat,p.id+'_swim_exit_chute',-18,z+.25,22,5,.3,16,'swim exit ramp from Dig Me Beach');
    box(g,steelMat,p.id+'_shower_arch',-18,z+2.2,22,5.2,3.8,.4,'freshwater rinse shower arch');
    return true;
  }

  if(p.visual_profile==='bike_works_kona_hub'){
    // Kopiko Plaza commercial building & outdoor mechanics clinic
    const stucco=new THREE.MeshStandardMaterial({color:0xa39d8f,roughness:.88});
    const timber=new THREE.MeshStandardMaterial({color:0x4a321f,roughness:.75});
    const parkToolBlue=new THREE.MeshStandardMaterial({color:0x0284c7,roughness:.5});
    const discWheel=new THREE.MeshStandardMaterial({color:0x111827,roughness:.4,metalness:.6});

    // Retail Storefront
    box(g,stucco,p.id+'_shop_shell',0,z+3.8,0,32,7.6,18,'kopiko plaza commercial building');
    box(g,shared.roof,p.id+'_shop_roof',0,z+8.1,0,34,.55,20,'slanted bronze metal roof');
    box(g,shared.glass,p.id+'_shop_glazing',0,z+2.6,-9.2,24,3.8,.2,'storefront display window');

    // Covered outdoor mechanic awning
    box(g,timber,p.id+'_mech_canopy',0,z+4.4,-14,28,.35,9.5,'outdoor mechanic tuning canopy');
    for(const px of [-12,0,12]){
      box(g,timber,p.id+'_canopy_post_'+px,px,z+2.2,-18,.35,4.4,.35,'awning timber post');
    }

    // 4 Park Tool professional repair stands with bikes
    for(let i=-1.5;i<=1.5;i++){
      const sx=i*6.5;
      box(g,parkToolBlue,p.id+'_parktool_stand_'+i,sx,z+1.1,-14,.18,2.2,.18,'park tool repair stand');
      box(g,discWheel,p.id+'_tuning_bike_'+i,sx,z+1.4,-14,1.1,.85,.25,'bike in tuning stand');
    }

    // Stacks of cardboard bike boxes and Scicon / Evoc travel cases
    for(let bx=-10;bx<=-4;bx+=2.8){
      box(g,shared.food,p.id+'_bike_travel_box_'+bx,bx,z+1.1,-11.5,1.8,1.4,.75,'athlete bike travel case');
    }
    return true;
  }

  if(p.visual_profile==='hp_bikeworks_lab'){
    // High-performance bike fitting and Di2 laboratory on Luhia St
    const charcoalSteel=new THREE.MeshStandardMaterial({color:0x27272a,roughness:.5,metalness:.6});
    const orangeTrim=new THREE.MeshStandardMaterial({color:0xea580c,roughness:.4});
    box(g,charcoalSteel,p.id+'_lab_shell',0,z+3.2,0,24,6.4,16,'industrial performance workshop');
    box(g,orangeTrim,p.id+'_orange_fascia',0,z+6.4,-8.2,24.5,.45,.4,'branded orange entrance fascia');
    box(g,shared.glass,p.id+'_rollup_garage_bay',0,z+2.4,-8.1,14,4.2,.15,'glass roll-up workshop bay door');
    // Inside Retül fit bike proxy
    box(g,orangeTrim,p.id+'_retul_fit_jig',0,z+1.2,-2,1.8,1.4,.65,'retul precision fitting machine');
    return true;
  }

  if(p.visual_profile==='lava_java_lanai'){
    // Island Lava Java oceanfront restaurant & open-air breakfast lanai
    const creamStucco=new THREE.MeshStandardMaterial({color:0xf5efe6,roughness:.85});
    const ipeDeck=new THREE.MeshStandardMaterial({color:0x5c381e,roughness:.72});
    const umbrellaGold=new THREE.MeshStandardMaterial({color:0xeab308,roughness:.6});

    // Two-story oceanfront plantation building
    box(g,creamStucco,p.id+'_main_building',0,z+4.6,0,26,9.2,16,'two-story oceanfront restaurant building');
    box(g,shared.roof,p.id+'_terrace_roof',0,z+9.6,0,28,.6,18,'hipped roofline');

    // The famous wrap-around dining lanai extending towards the ocean
    box(g,ipeDeck,p.id+'_dining_lanai_deck',0,z+1.1,-13,28,.35,9.5,'famous open-air oceanfront dining lanai');
    // Railings & posts
    for(let rx=-13;rx<=13;rx+=4.3){
      box(g,ipeDeck,p.id+'_lanai_post_'+rx,rx,z+2.1,-17.5,.18,1.9,.18,'lanai railing post');
    }

    // Outdoor cafe dining tables with yellow sun umbrellas
    for(let tx=-10;tx<=10;tx+=5){
      box(g,ipeDeck,p.id+'_cafe_table_'+tx,tx,z+1.8,-13,1.2,.85,1.2,'outdoor cafe dining table');
      const umb=new THREE.Mesh(new THREE.ConeGeometry(1.8,.75,8),umbrellaGold);
      umb.position.set(tx,z+3.8,-13); g.add(umb);
    }
    // Sidewalk athlete bike racks
    box(g,shared.service,p.id+'_athlete_bike_rack',0,z+.7,10,14,.9,.25,'morning ride bike valet rack');
    return true;
  }

  if(p.visual_profile==='huggos_on_the_rocks'){
    // Huggo's on the Rocks open-air tiki bar on volcanic rock over the surf
    const lavaMat=shared.lava||new THREE.MeshStandardMaterial({color:0x1c1917,roughness:.95});
    const thatchMat=new THREE.MeshStandardMaterial({color:0x5a462d,roughness:.95});
    const timberMat=new THREE.MeshStandardMaterial({color:0x452a16,roughness:.75});
    const sandMat=new THREE.MeshStandardMaterial({color:0xe5d5b5,roughness:.9});

    // Basalt lava foundation plinth jutting into waves
    box(g,lavaMat,p.id+'_lava_plinth',0,z+.4,0,32,.9,26,'volcanic basalt promontory foundation');
    box(g,sandMat,p.id+'_sand_deck',0,z+.9,0,28,.2,22,'sandy open-air seaside dining floor');

    // Thatched Tiki Bar Pavilion
    for(const px of [-6,6]){
      for(const pz of [-6,6]){
        box(g,timberMat,p.id+'_tiki_post_'+px+'_'+pz,px,z+2.6,pz,.35,3.6,.35,'ohia timber bar post');
      }
    }
    box(g,timberMat,p.id+'_koa_bar_counter',0,z+1.6,0,10,1.2,3.5,'curved koa wood tiki bar counter');
    const tikiRoof=new THREE.Mesh(new THREE.CylinderGeometry(.6,9.5,3.6,4),thatchMat);
    tikiRoof.position.set(0,z+5.8,0); tikiRoof.rotation.y=Math.PI/4; g.add(tikiRoof);

    // Bamboo perimeter tiki torches
    for(let a=0;a<8;a++){
      const ang=a/8*Math.PI*2;
      const tx=Math.cos(ang)*13, tz=Math.sin(ang)*10;
      box(g,timberMat,p.id+'_tiki_torch_pole_'+a,tx,z+2.1,tz,.08,2.4,.08,'bamboo tiki torch stake');
      box(g,new THREE.MeshStandardMaterial({color:0xf59e0b,emissive:0xf59e0b,emissiveIntensity:1.5}),p.id+'_torch_flame_'+a,tx,z+3.3,tz,.2,.35,.2,'flickering torch flame');
    }
    return true;
  }

  if(p.visual_profile==='kona_brewing_pub'){
    // Kona Brewing Co. Brewhouse & Pub on Pawai Pl
    const timberDark=new THREE.MeshStandardMaterial({color:0x3b2716,roughness:.75});
    const copperMat=new THREE.MeshStandardMaterial({color:0xb45309,roughness:.35,metalness:.8});
    const steelMat=new THREE.MeshStandardMaterial({color:0x9ca3af,roughness:.3,metalness:.85});

    // Brewhouse Main Building
    box(g,timberDark,p.id+'_brewhouse_building',0,z+4.5,0,34,9.0,18,'rustic industrial brewhouse building');
    box(g,shared.roof,p.id+'_brewhouse_roof',0,z+9.5,0,36,.6,20,'corrugated bronze roof with cupola vents');

    // Copper & Stainless Steel Brewing Vats (visible through glass wall)
    for(let vi=-1.5;vi<=1.5;vi++){
      const vx=vi*4.2;
      const vatMat=Math.abs(vi)>1?copperMat:steelMat;
      const vat=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,5.8,16),vatMat);
      vat.position.set(vx,z+3.6,-4); g.add(vat);
    }

    // Giant Outdoor Garden Lanai (Beer Garden)
    box(g,shared.food,p.id+'_beer_garden_deck',0,z+.3,-16,36,.4,14,'open-air covered garden lanai');
    // Long picnic tables with benches
    for(let pi=-2;pi<=2;pi++){
      box(g,timberDark,p.id+'_picnic_table_'+pi,pi*6.8,z+1.1,-16,4.5,.85,1.8,'communal wooden picnic table');
    }
    return true;
  }

  if(p.visual_profile==='splashers_grill_overlook'){
    // Splashers Grill overlooking Kailua Bay swim start
    const coralStucco=new THREE.MeshStandardMaterial({color:0xf3e8d9,roughness:.85});
    const railWhite=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6});
    box(g,coralStucco,p.id+'_main_body',0,z+4.2,0,24,8.4,16,'two-story ocean overlook building');
    box(g,shared.food,p.id+'_balcony_deck',0,z+4.4,-10,26,.35,6.5,'second-story open-air dining balcony');
    box(g,railWhite,p.id+'_balcony_rail',0,z+5.2,-13,26,.85,.12,'panoramic dining railing over Kailua Bay');
    return true;
  }

  if(p.visual_profile==='fosters_kitchen_balcony'){
    // Foster's Kitchen second-story balcony dining over Aliʻi Drive
    const darkWood=new THREE.MeshStandardMaterial({color:0x362312,roughness:.72});
    box(g,darkWood,p.id+'_building_body',0,z+4.5,0,26,9.0,16,'classic two-story plantation building');
    box(g,darkWood,p.id+'_wrap_balcony',0,z+4.6,-10,28,.35,6.2,'second-story covered veranda over Aliʻi Dr');
    box(g,shared.roof,p.id+'_balcony_roof',0,z+7.8,-10,29,.4,7.2,'balcony overhang');
    return true;
  }

  if(p.visual_profile==='big_island_running_shop'){
    // Big Island Running Company boutique running center on Aliʻi Dr
    const tealMat=new THREE.MeshStandardMaterial({color:0x0d9488,roughness:.5});
    box(g,shared.shop,p.id+'_store_body',0,z+3.2,0,22,6.4,14,'aliʻi sunset plaza retail unit');
    box(g,tealMat,p.id+'_teal_awning',0,z+4.8,-7.8,20,.25,2.8,'signature teal fabric awning');
    box(g,shared.glass,p.id+'_shoe_windows',0,z+2.4,-7.1,16,3.2,.15,'running shoe display picture window');
    // Runner hydration station & bench
    box(g,tealMat,p.id+'_water_cooler',-6.5,z+1.2,-8.5,.6,1.1,.6,'gatorade runner hydration station');
    box(g,shared.food,p.id+'_runner_bench',4.5,z+.65,-8.5,2.4,.55,.75,'runner group gathering bench');
    return true;
  }

  if(p.visual_profile==='palani_hot_corner_climb'){
    // Palani Road Hot Corner steep ascent & crowd corridor
    const metalMat=shared.service;
    const bannerMat=new THREE.MeshStandardMaterial({color:0xdc2626,roughness:.6});
    box(g,shared.asphalt,p.id+'_palani_asphalt',0,z+.15,0,12,.2,34,'steep palani hillclimb road surface');
    for(const side of [-5.5,5.5]){
      box(g,metalMat,p.id+'_barricade_'+side,side,z+.7,0,.12,1.1,32,'spectator crowd control barricade');
      box(g,bannerMat,p.id+'_banner_'+side,side,z+.65,0,.15,.85,28,'hot corner sponsor chevron banner');
    }
    // TV broadcast camera scaffolding tower
    box(g,metalMat,p.id+'_camera_tower',-8.5,z+3.2,8,2.4,6.4,2.4,'live worldwide tv broadcast tower');
    return true;
  }


  if(p.visual_profile==='kona_inn_shopping_village'){
    // Historic 1928 Kona Inn shopping village and oceanfront boardwalk
    const creamWall = new THREE.MeshStandardMaterial({color:0xfaf4eb, roughness:0.85});
    const darkWood = new THREE.MeshStandardMaterial({color:0x3a2312, roughness:0.75});
    const cedarRoof = new THREE.MeshStandardMaterial({color:0x523b28, roughness:0.88});
    const boardwalkWood = new THREE.MeshStandardMaterial({color:0x6b4f35, roughness:0.7});
    const brassLamp = new THREE.MeshStandardMaterial({color:0xd97706, roughness:0.3, metalness:0.8});
    const lawnGreen = new THREE.MeshStandardMaterial({color:0x3f6212, roughness:0.9});
    const seaWall = new THREE.MeshStandardMaterial({color:0x27272a, roughness:0.95});

    // Historic Two-Story Main Building (44m x 18m)
    box(g, creamWall, p.id+'_inn_main', 0, z+5.2, 0, 44, 10.4, 18, 'historic 1928 kona inn two-story building');
    box(g, cedarRoof, p.id+'_inn_roof', 0, z+11.2, 0, 47, 1.8, 21, 'hipped cedar shake roof');
    for(const cx of [-14, 0, 14]){
      box(g, creamWall, p.id+'_cupola_'+cx, cx, z+12.6, 0, 4, 1.6, 4, 'roof ventilation cupola');
      box(g, cedarRoof, p.id+'_cupola_cap_'+cx, cx, z+13.7, 0, 4.6, 0.6, 4.6, 'cupola shake roof cap');
    }

    // Long One-Story Retail Arcade Wing extending South (36m x 14m)
    box(g, creamWall, p.id+'_arcade_wing', 26, z+3.8, 14, 36, 7.6, 14, 'boardwalk shops arcade');
    box(g, cedarRoof, p.id+'_arcade_roof', 26, z+8.2, 14, 38, 1.4, 16, 'arcade hipped roof');

    // Waterfront Timber Boardwalk (70m x 5m) overlooking Kailua Bay
    box(g, boardwalkWood, p.id+'_boardwalk_deck', 8, z+0.85, -14, 70, 0.5, 5.2, 'historic oceanfront boardwalk');
    for(let bx=-24; bx<=40; bx+=4.8){
      box(g, darkWood, p.id+'_rail_post_'+bx, bx, z+1.7, -16.4, 0.22, 1.2, 0.22, 'boardwalk railing post');
      if(bx % 9.6 === 0){
        box(g, brassLamp, p.id+'_nautical_lamp_'+bx, bx, z+2.4, -16.4, 0.35, 0.45, 0.35, 'nautical brass post lamp');
      }
    }
    box(g, darkWood, p.id+'_top_rail', 8, z+2.1, -16.4, 70, 0.15, 0.25, 'boardwalk continuous handrail');

    // Kona Inn Restaurant & Grill Covered Dining Lanai
    box(g, darkWood, p.id+'_grill_deck', -12, z+1.2, -11, 22, 0.6, 7.5, 'kona inn grill oceanfront dining lanai');
    box(g, cedarRoof, p.id+'_grill_canopy', -12, z+4.6, -11, 23, 0.35, 8.5, 'dining lanai canopy');
    for(const px of [-22, -12, -2]){
      box(g, darkWood, p.id+'_lanai_timber_post_'+px, px, z+2.8, -14.8, 0.35, 3.2, 0.35, 'lanai support timber');
    }
    box(g, darkWood, p.id+'_koa_bar', -12, z+1.8, -8.5, 12, 1.1, 2.2, 'polished koa wood cocktail bar');
    for(let tx=-20; tx<=-4; tx+=4){
      box(g, darkWood, p.id+'_dining_table_'+tx, tx, z+1.6, -12, 1.2, 0.8, 1.2, 'oceanfront cocktail table');
    }

    // Oceanfront Manicured Green Lawn between Boardwalk and Basalt Seawall
    box(g, lawnGreen, p.id+'_ocean_lawn', 8, z+0.4, -22, 70, 0.3, 11, 'iconic oceanfront sunset lawn');
    box(g, seaWall, p.id+'_basalt_seawall', 8, z+0.3, -28, 72, 0.9, 2.4, 'volcanic basalt ocean retaining wall');

    // Shading Coconut Palms along the ocean lawn
    for(let pi=0; pi<6; pi++){
      const px = -22 + pi * 12;
      const pz = -23 + (pi % 2) * 3;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 8.5, 8), darkWood);
      trunk.position.set(px, z+4.6, pz);
      trunk.rotation.z = (pi % 2 === 0 ? 0.08 : -0.06);
      g.add(trunk);
      const palmCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 0), shared.park||lawnGreen);
      palmCrown.scale.set(1.4, 0.6, 1.4);
      palmCrown.position.set(px + (pi % 2 === 0 ? 0.6 : -0.5), z+9.2, pz);
      g.add(palmCrown);
    }
    return true;
  }

  if(p.visual_profile==='huggos_oceanfront_dining'){
    // Huggo's world-famous oceanfront dining cantilevered over breaking surf
    const darkWood = new THREE.MeshStandardMaterial({color:0x3d2716, roughness:0.75});
    const teakDeck = new THREE.MeshStandardMaterial({color:0x6c4e32, roughness:0.7});
    const whiteLinen = new THREE.MeshStandardMaterial({color:0xf8fafc, roughness:0.85});
    const basaltRock = new THREE.MeshStandardMaterial({color:0x1c1917, roughness:0.98});
    const hurricaneLamp = new THREE.MeshStandardMaterial({color:0xfef08a, emissive:0xfef08a, emissiveIntensity:0.6});
    const glassRail = shared.glass;

    // Basalt foundation & concrete pilings extending into the surf
    for(let px=-10; px<=10; px+=5){
      for(let pz=-12; pz<=2; pz+=5){
        box(g, basaltRock, p.id+'_piling_'+px+'_'+pz, px, z+1.1, pz, 1.2, 2.2, 1.2, 'heavy concrete/basalt surf piling');
      }
    }

    // Over-water Cantilevered Dining Deck (26m x 16m)
    box(g, teakDeck, p.id+'_overwater_deck', 0, z+2.3, -5, 26, 0.4, 16, 'ipe hardwood over-water dining deck');
    box(g, glassRail, p.id+'_surf_glass_rail', 0, z+3.1, -13, 26, 1.2, 0.15, 'panoramic glass windbreak over waves');
    box(g, darkWood, p.id+'_surf_rail_cap', 0, z+3.7, -13, 26.2, 0.12, 0.25, 'mahogany railing cap');
    for(const side of [-13, 13]){
      box(g, glassRail, p.id+'_side_glass_'+side, side, z+3.1, -5, 0.15, 1.2, 16, 'side glass windscreen');
    }

    // Covered Main Dining Room with open oceanfront walls
    box(g, darkWood, p.id+'_dining_shell', 0, z+5.2, 4, 24, 5.8, 12, 'open-timber ocean dining pavilion');
    box(g, shared.roof, p.id+'_dining_roof', 0, z+8.4, 4, 26, 1.2, 14, 'hipped cedar roof with clerestory vents');

    // Linen-draped dining tables with glowing hurricane lamps
    for(let tx=-9; tx<=9; tx+=4.5){
      for(let tz=-10; tz<=-2; tz+=4){
        box(g, whiteLinen, p.id+'_table_'+tx+'_'+tz, tx, z+2.9, tz, 1.4, 0.85, 1.4, 'fine dining table with white linen');
        box(g, hurricaneLamp, p.id+'_lamp_'+tx+'_'+tz, tx, z+3.5, tz, 0.2, 0.35, 0.2, 'flickering hurricane candle lamp');
      }
    }

    // Timber boardwalk path connecting to On the Rocks
    box(g, teakDeck, p.id+'_connecting_walkway', 14, z+2.2, 8, 8, 0.35, 18, 'connecting boardwalk to on the rocks');
    return true;
  }

  if(p.visual_profile==='white_nene_coffee_roastery'){
    // White Nene Coffee Roasters downtown roastery on Aliʻi Dr
    const whitePlank = new THREE.MeshStandardMaterial({color:0xf3f4f6, roughness:0.85});
    const sageGreen = new THREE.MeshStandardMaterial({color:0x4d6652, roughness:0.8});
    const chromeMetal = new THREE.MeshStandardMaterial({color:0xd1d5db, roughness:0.2, metalness:0.9});
    const darkTimber = new THREE.MeshStandardMaterial({color:0x3f2e1e, roughness:0.75});

    // Historic Plantation Coffee House (20m x 12m)
    box(g, whitePlank, p.id+'_roastery_body', 0, z+3.8, 0, 20, 7.6, 12, 'whitewashed plantation coffee roastery');
    box(g, sageGreen, p.id+'_sage_roof', 0, z+8.0, 0, 22, 0.8, 14, 'sage green corrugated metal roof');

    // Covered Porch Veranda with outdoor athlete tables
    box(g, darkTimber, p.id+'_porch_deck', 0, z+0.5, -8, 22, 0.35, 5, 'covered customer veranda');
    box(g, sageGreen, p.id+'_porch_canopy', 0, z+4.2, -8, 22, 0.25, 5.5, 'porch awning');
    for(const px of [-10, 0, 10]){
      box(g, whitePlank, p.id+'_porch_column_'+px, px, z+2.3, -10.2, 0.3, 3.8, 0.3, 'veranda post');
    }
    for(let bx=-6; bx<=6; bx+=6){
      box(g, darkTimber, p.id+'_picnic_bench_'+bx, bx, z+1.0, -8, 3.2, 0.75, 1.4, 'outdoor coffee table & bench');
    }

    // Bike Parking Rack for morning ride/swim athletes
    box(g, shared.service, p.id+'_athlete_bike_rack', -9, z+0.85, -12, 6, 0.9, 0.3, 'triathlete road bike parking rack');

    // Interior Espresso Bar visible through storefront display window
    box(g, shared.glass, p.id+'_store_window', 0, z+2.8, -6.1, 14, 3.5, 0.15, 'storefront display window');
    box(g, darkTimber, p.id+'_espresso_bar', 0, z+1.8, -3, 10, 1.1, 1.8, 'dark timber espresso bar counter');
    box(g, chromeMetal, p.id+'_espresso_machine', -1.5, z+2.5, -3, 1.4, 0.75, 0.8, 'commercial chrome espresso machine');
    box(g, darkTimber, p.id+'_grinders', 1.5, z+2.5, -3, 0.8, 0.85, 0.5, 'coffee bean burr grinders');
    return true;
  }

  if(p.visual_profile==='kta_superstores_kailua'){
    // KTA Super Stores - Kailua-Kona (Palani Rd)
    const ktaGreen = new THREE.MeshStandardMaterial({color:0x1b4332, roughness:0.8});
    const ktaRed = new THREE.MeshStandardMaterial({color:0xb91c1c, roughness:0.6});
    const wallStucco = new THREE.MeshStandardMaterial({color:0xeee8d5, roughness:0.9});
    const glassDoor = shared.glass;
    const yellowFruit = new THREE.MeshStandardMaterial({color:0xeab308, roughness:0.7});
    const blueWater = new THREE.MeshStandardMaterial({color:0x2563eb, roughness:0.5});

    // Broad Supermarket Building (52m x 36m)
    box(g, wallStucco, p.id+'_market_shell', 0, z+4.6, 0, 52, 9.2, 36, 'kta super stores supermarket building');
    box(g, ktaGreen, p.id+'_green_roof', 0, z+9.8, 0, 54, 1.2, 38, 'green standing-seam hipped metal roof');

    // Prominent Red & Green Entrance Portal Canopy
    box(g, ktaRed, p.id+'_entry_canopy', 0, z+5.2, -19.5, 22, 1.6, 3.5, 'iconic kta red sign marquee');
    box(g, glassDoor, p.id+'_sliding_doors', 0, z+2.4, -18.1, 16, 4.0, 0.2, 'automatic supermarket sliding entrance doors');

    // Covered Sidewalk Arcade with Local Fruit & Produce Displays
    box(g, wallStucco, p.id+'_sidewalk_arcade', 0, z+0.35, -21.5, 48, 0.35, 5, 'covered entrance walkway');
    for(let bx=-18; bx<=-8; bx+=4.5){
      box(g, wallStucco, p.id+'_produce_stand_'+bx, bx, z+1.1, -21.5, 3.2, 0.9, 1.8, 'outdoor fresh pineapple/papaya fruit stand');
      box(g, yellowFruit, p.id+'_pineapples_'+bx, bx, z+1.7, -21.5, 2.8, 0.45, 1.4, 'fresh hawaiian pineapples');
    }

    // Staging Pallets of Bottled Spring Water & Electrolyte Drinks for Race Week
    for(let wx=8; wx<=18; wx+=4.5){
      box(g, blueWater, p.id+'_water_pallet_'+wx, wx, z+1.2, -21.5, 3.2, 1.4, 2.2, 'pallets of bottled water for triathletes');
    }

    // Customer Parking Lot with Marked Stalls & Palm Planters
    box(g, shared.asphalt, p.id+'_parking_lot', 0, z+0.12, -36, 60, 0.15, 24, 'kta customer parking lot');
    for(let cx=-20; cx<=20; cx+=10){
      const truckMat = new THREE.MeshStandardMaterial({color:(cx===0?0xd97706:0x374151), roughness:0.4, metalness:0.3});
      box(g, truckMat, p.id+'_island_truck_'+cx, cx, z+1.1, -36, 2.4, 1.6, 4.8, 'customer pickup truck/suv');
    }
    return true;
  }

  if(p.visual_profile==='safeway_kona_center'){
    // Safeway - Kona (Henry St)
    const sandStone = new THREE.MeshStandardMaterial({color:0xd6cbbe, roughness:0.88});
    const safewayRed = new THREE.MeshStandardMaterial({color:0xc21807, roughness:0.5});
    const basaltTrim = new THREE.MeshStandardMaterial({color:0x292524, roughness:0.95});
    const roofBronze = new THREE.MeshStandardMaterial({color:0x4a3b32, roughness:0.75});

    // Modern Anchor Retail Complex (60m x 40m)
    box(g, sandStone, p.id+'_safeway_building', 0, z+5.5, 0, 60, 11.0, 40, 'safeway supermarket complex');
    box(g, roofBronze, p.id+'_safeway_roof', 0, z+11.4, 0, 62, 0.9, 42, 'bronze architectural roof');
    box(g, basaltTrim, p.id+'_basalt_wainscot', 0, z+1.2, -20.2, 60.5, 2.4, 0.4, 'volcanic basalt wainscot base');

    // Central Signature Red Arched Portal Entrance
    box(g, safewayRed, p.id+'_red_portal', 0, z+7.2, -21, 24, 2.6, 2.4, 'safeway signature red arched portal entrance');
    box(g, shared.glass, p.id+'_glass_curtain', 0, z+3.8, -20.2, 22, 5.8, 0.25, 'storefront glass vestibule & clerestory');

    // Outdoor Floral Gazebo & Tropical Plant Pavilion
    box(g, sandStone, p.id+'_floral_kiosk', -22, z+2.2, -24, 10, 4.4, 8, 'outdoor floral & garden department gazebo');
    box(g, new THREE.MeshStandardMaterial({color:0xdb2777, roughness:0.8}), p.id+'_orchids', -22, z+1.8, -24, 8, 1.2, 6, 'hawaiian potted orchids display');

    // Athlete Fuel Staging Bay
    box(g, new THREE.MeshStandardMaterial({color:0x0284c7, roughness:0.5}), p.id+'_sports_fuel', 22, z+1.4, -24, 10, 1.8, 6, 'pallet staging of gatorade & bottled water');
    return true;
  }

  if(p.visual_profile==='boss_frogs_dive_and_bike'){
    // Boss Frog's Snorkel, Bike & Beach Rentals on Palani Rd
    const frogYellow = new THREE.MeshStandardMaterial({color:0xfacc15, roughness:0.6});
    const frogGreen = new THREE.MeshStandardMaterial({color:0x16a34a, roughness:0.6});
    const woodDeck = new THREE.MeshStandardMaterial({color:0x785338, roughness:0.75});
    const bikeMetal = new THREE.MeshStandardMaterial({color:0x2563eb, roughness:0.4, metalness:0.5});

    // Bright Tropical Storefront (20m x 12m)
    box(g, frogYellow, p.id+'_shop_shell', 0, z+3.6, 0, 20, 7.2, 12, 'vibrant yellow rental retail building');
    box(g, frogGreen, p.id+'_green_awning', 0, z+5.2, -6.8, 21, 0.35, 2.8, 'lime green storefront awning');
    box(g, shared.glass, p.id+'_display_glazing', 0, z+2.6, -6.1, 16, 3.6, 0.15, 'rental gear shopfront window');

    // Outdoor Rental Bike Corral with parked road bikes and cruisers
    box(g, woodDeck, p.id+'_bike_corral', -6, z+0.25, -9, 10, 0.3, 4.5, 'bike rental staging corral');
    for(let bi=-10; bi<=-2; bi+=1.8){
      box(g, bikeMetal, p.id+'_rental_bike_'+bi, bi, z+1.1, -9, 0.9, 0.8, 0.25, 'rental cruiser/road bike');
    }

    // Vertical Stand-Up Paddleboard (SUP) & Surfboard Racks
    for(let si=2; si<=8; si+=1.8){
      const boardMat = new THREE.MeshStandardMaterial({color:(si%2===0?0x06b6d4:0xf97316), roughness:0.4});
      const board = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 2.6, 4, 12), boardMat);
      board.position.set(si, z+2.2, -8.5);
      board.rotation.z = 0.08;
      g.add(board);
    }
    return true;
  }

  if(p.visual_profile==='old_kona_airport_recreation_park'){
    // Old Kona Airport State Recreation Area (historic 3,800 ft runway park)
    const oldAsphalt = new THREE.MeshStandardMaterial({color:0x374151, roughness:0.95});
    const markingWhite = new THREE.MeshStandardMaterial({color:0xd1d5db, roughness:0.9});
    const glulamWood = new THREE.MeshStandardMaterial({color:0x5c3d26, roughness:0.75});
    const ironwoodGreen = new THREE.MeshStandardMaterial({color:0x14532d, roughness:0.95});

    // Historic 3,800-foot Runway Strip (represented as 280m x 24m corridor in local space)
    box(g, oldAsphalt, p.id+'_historic_runway', 0, z+0.2, 0, 24, 0.2, 280, 'historic 1940s-1970s airfield asphalt runway');
    for(let cz=-120; cz<=120; cz+=24){
      box(g, markingWhite, p.id+'_runway_dash_'+cz, 0, z+0.32, cz, 1.2, 0.06, 12, 'weathered white runway centerline stripe');
    }
    box(g, markingWhite, p.id+'_threshold_s', 0, z+0.32, 130, 16, 0.06, 3.5, 'runway 11 south threshold stripe');
    box(g, markingWhite, p.id+'_threshold_n', 0, z+0.32, -130, 16, 0.06, 3.5, 'runway 29 north threshold stripe');

    // Makaʻeo County Pavilion (Large Timber Arch Community Center)
    box(g, shared.meeting, p.id+'_makaoe_slab', 28, z+0.4, 20, 26, 0.5, 18, 'makaʻeo pavilion concrete foundation slab');
    const archRoof = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 26, 16, 1, false, 0, Math.PI), glulamWood);
    archRoof.position.set(28, z+6.5, 20);
    archRoof.rotation.z = Math.PI/2;
    archRoof.scale.set(0.6, 1, 0.8);
    g.add(archRoof);

    // Coastal Ironwood Trees lining the ocean breeze side
    for(let ti=-5; ti<=5; ti++){
      const tz = ti * 26;
      const ironwood = new THREE.Mesh(new THREE.ConeGeometry(3.5, 11, 8), ironwoodGreen);
      ironwood.position.set(-22, z+5.8, tz);
      g.add(ironwood);
    }

    // Oceanfront Covered Picnic Pavilions
    for(const pz of [-60, 60]){
      box(g, glulamWood, p.id+'_picnic_pavilion_'+pz, -16, z+2.2, pz, 8, 0.35, 6, 'beach picnic pavilion canopy');
      for(const px of [-19, -13]){
        box(g, glulamWood, p.id+'_picnic_post_'+px+'_'+pz, px, z+1.1, pz, 0.25, 2.2, 0.25, 'pavilion post');
      }
      box(g, glulamWood, p.id+'_picnic_table_'+pz, -16, z+0.85, pz, 4.2, 0.75, 1.8, 'wooden beach park picnic table');
    }
    return true;
  }

  return false;
}
