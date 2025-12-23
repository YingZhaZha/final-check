
import { SectionConfig } from './types';

export const INSPECTOR_REQUIREMENTS = [
  "1. 由相应飞机行业负责人及L3授权人员施行。",
  "2. 必须在交机前半天执行最终检查，并在临交机前再进行一次 FOD 检查。",
  "3. 严格按照步骤逐项检查确认，不得遗漏。",
  "4. 涉及门上工作（登机门、应急门），必须实行双人互检。",
  "5. 检查完后将报告分享给车间负责人或班组群里留底。"
];

export const CHECKLIST_DATA: SectionConfig[] = [
  {
    id: 'section_1',
    title: '一、驾驶舱区域 (检查顺序如下)',
    items: [
      { id: '1_1', text: '1、驾驶舱面板紧固件安装正确，盒子及其他区域无FOD。', type: 'simple' },
      { id: '1_2', text: '2、驾驶舱随机资料摆放整齐到位，三证齐全。', type: 'simple' },
      { id: '1_3', text: '3、驾驶舱衬板，存储区域整洁。', type: 'simple' },
      { id: '1_4', text: '4、驾驶舱应急设备安装正确，无松动。', type: 'simple' },
      { id: '1_5', text: '5、防雨剂是否满足工卡要求 (个别航空公司有工卡要求，没有要求则N/A)。', type: 'simple' },
      { id: '1_6', text: '6、备用灯泡盒是否在位。', type: 'simple' },
      { id: '1_7', text: '7、确保机头前三角板安装在位。', type: 'simple' },
    ],
  },
  {
    id: 'section_2',
    title: '二、客舱区域 (检查顺序如下)',
    items: [
      { 
        id: '2_1', 
        text: '1、LAV A，移出马桶罩确认冲洗阀及水加热器正常，无漏水及FOD，管路安装正确，安装马桶罩，确认面板安装正确，标牌完整。', 
        type: 'simple' 
      },
      { 
        id: '2_2', 
        text: '2、LAV A 勤务柜通风口有明显风量。', 
        type: 'simple' 
      },
      { 
        id: '2_3', 
        text: '3、前厨房烤箱，煮水器，咖啡机等安装及功能正常，无漏水；资料箱和餐车安装正确。厨房柜内干净，无FOD。标牌完整。', 
        type: 'simple' 
      },
      { 
        id: '2_4', 
        text: '4、前厨房烤箱，冰柜/抽屉，资料箱，垃圾箱，餐车内部及背后，无FOD。', 
        type: 'simple' 
      },
      { 
        id: '2_5', 
        text: '5、应急设备安装正确，无松动 (核对离散设备清单)。', 
        type: 'simple' 
      },
      {
        id: '2_6',
        text: '6、“L1/R1” 登机门衬板，门框衬板，手柄等安装正确，无松动；门框封严条无露出，门警告灯正常。标牌完整。灯盖安装正常。门框衬板通风口出风正常。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'L1', label: 'L1' }, { id: 'R1', label: 'R1' }],
      },
      {
        id: '2_7',
        text: '7、“L1/R1” 登机门紧急开门作动筒舌片预位拔出保险销，气瓶压力正常。预位，解除预位手柄开关顺畅，无回弹现象。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'L1', label: 'L1' }, { id: 'R1', label: 'R1' }],
        requiresInput: true,
        inputLabel: 'PSI',
        pressureType: 'number'
      },
      {
        id: '2_8',
        text: '8、“L1/R1” 登机门滑梯包安全插销拔出并保存在滑梯内。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'L1', label: 'L1' }, { id: 'R1', label: 'R1' }],
      },
      {
        id: '2_9',
        text: '9、“L1/R1” 登机门滑梯包导线走向正 [+] (走向朝向机头)',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'L1', label: 'L1' }, { id: 'R1', label: 'R1' }],
      },
      { id: '2_10', text: '10、衣帽柜安装正确，无松动，内无FOD (如有安装)', type: 'simple' },
      { id: '2_11', text: '11、确认客舱区域隔帘安装位置正确，无松动。', type: 'simple' },
      {
        id: '2_12',
        text: '12、天花板安装正确；行李架门安装正确，行李架扶手位置正确，行李架内部无异物；墙角面板安装正确；客舱衬板整洁。标牌完整。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'ceil', label: '天花板' }, { id: 'bin', label: '行李架' }],
      },
      {
        id: '2_13',
        text: '13、客舱温度探测器出风口吸力正常。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'fwd', label: '前' }, { id: 'aft', label: '后' }],
      },
      {
        id: '2_14',
        text: '14、应急门衬板安装正确 (小盖板安装位置正确)',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'LH', label: 'LH' }, { id: 'RH', label: 'RH' }],
      },
      {
        id: '2_15',
        text: '15、应急门拔出气瓶保险销，拔除门框安全销 (若安装)，应急门预位。(适用于 A320 或 A319)',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'LH', label: 'LH' }, { id: 'RH', label: 'RH' }],
      },
      {
        id: '2_16',
        text: '16、A321 机型应急门衬板安装正确，警告灯正常。门气瓶销子移出，门框上预位挂钩销子移出，行李架内部滑梯气瓶销子拔出并打好保险，检查滑梯气瓶调节阀组件上的支架有无断裂。预位，解除预位手柄开关顺畅，无回弹现象。(适用于 A321)',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'L1', label: 'L1' }, { id: 'R1', label: 'R1' }, { id: 'L2', label: 'L2' }, { id: 'R2', label: 'R2' }],
        requiresInput: true,
        pressureType: 'range' 
      },
      { 
        id: '2_17', 
        text: '17、中间厨房的烤箱，煮水器，咖啡机等安装及功能正常，无漏水；资料箱和餐车安装正确。厨房柜内干净，无FOD。标牌完整。(适用于 A321)', 
        type: 'simple' 
      },
      { 
        id: '2_18', 
        text: '18、中间厨房烤箱，冰柜/抽屉，资料箱，垃圾箱，餐车内部及背后，无FOD。(适用于 A321)', 
        type: 'simple' 
      },
      {
        id: '2_19',
        text: '19、LAV H/L/M 移出马桶罩确认冲洗阀及水加热器正常，无漏水及FOD，管路安装正确，安装马桶罩，面板安装正确，标牌完整。勤务柜通风口有明显风量。(适用于 A321)',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'H', label: 'H' }, { id: 'L', label: 'L' }, { id: 'M', label: 'M' }]
      },
      {
        id: '2_20',
        text: '20、LAV D/E 或 F/G 移出马桶罩确认冲洗阀及水加热器正常，无漏水及FOD，管路安装正确，安装马桶罩，面板安装正确，标牌正常。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'D', label: 'D' }, { id: 'E', label: 'E' }, { id: 'F', label: 'F' }, { id: 'G', label: 'G' }]
      },
      {
        id: '2_21',
        text: '21、LAV D/E 或 F/G 勤务柜通风口有明显风量。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'D', label: 'D' }, { id: 'E', label: 'E' }, { id: 'F', label: 'F' }, { id: 'G', label: 'G' }]
      },
      { 
        id: '2_22', 
        text: '22、后厨房的烤箱，煮水器，咖啡机等安装及功能正常，无漏水；资料箱和餐车安装正确。厨房柜内干净，无FOD。标牌完整。', 
        type: 'simple' 
      },
      {
        id: '2_23',
        text: '23、后厨房烤箱，冰柜/抽屉，资料箱，垃圾箱，餐车内部及背后，无FOD。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'G4', label: 'G4' }, { id: 'G5', label: 'G5' }]
      },
      {
        id: '2_24',
        text: '24、“L2/R2” 登机门衬板，门框衬板，手柄等安装正确，无松动；门框封严条无露出，门警告灯正常。标牌完整。灯盖安装正常。门框衬板通风口出风正常。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'L2', label: 'L2' }, { id: 'R2', label: 'R2' }],
      },
      {
        id: '2_25',
        text: '25、“L2/R2” 登机门紧急开门作动筒舌片预位，拔出保险销，气瓶压力正常。预位，解除预位手柄开关顺畅，无回弹现象。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'L2', label: 'L2' }, { id: 'R2', label: 'R2' }],
        requiresInput: true,
        inputLabel: 'PSI',
        pressureType: 'number'
      },
      {
        id: '2_26',
        text: '26、“L2/R2” 登机门滑梯包安全插销拔出并保存在滑梯内。',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'L2', label: 'L2' }, { id: 'R2', label: 'R2' }],
      },
      {
        id: '2_27',
        text: '27、“L2/R2” 登机门滑梯包导线走向 [+] (走向朝向机头)',
        type: 'multi',
        layout: 'grid',
        subItems: [{ id: 'L2', label: 'L2' }, { id: 'R2', label: 'R2' }],
      },
      { id: '2_28', text: '28、“安全须知”，“应急门安全须知”，“备用塑料箱”安装到位。', type: 'simple' },
      { id: '2_29', text: '29、四个滑梯盖子下部带子打结并保证不被门夹住。', type: 'simple' },
      { id: '2_30', text: '30、登机门+应急门外表面正常，未夹杂异物。', type: 'simple' },
      { 
        id: '2_31', 
        text: '31、对关键区域拍照并发飞机群内：', 
        type: 'multi',
        layout: 'list',
        subItems: [
          { id: 'p1', label: '登机门滑梯安全销、舌片和保险' },
          { id: 'p2', label: '登机门滑梯包导线走向' },
          { id: 'p3', label: '应急门安全销、预位及飘带情况' },
          { id: 'p4', label: '登机门和应急门外表面' },
        ]
      },
    ],
  },
  {
    id: 'section_3',
    title: '三、货舱区域 (检查顺序如下)',
    items: [
      { id: '3_1', text: '1、前货舱门功能正常，开关手柄和作动筒无漏油。', type: 'simple' },
      { id: '3_2', text: '2、前货舱地板，隔板，货网，seal 等安装正确，无FOD。标牌完整。', type: 'simple' },
      { id: '3_3', text: '3、前货舱侧壁板位置，顺序安装正确无误。', type: 'simple' },
      { id: '3_4', text: '4、后货舱门功能正常，开关手柄和作动筒无漏油。', type: 'simple' },
      { id: '3_5', text: '5、后货舱气瓶拔出保险销，并存放在气瓶包内。(适用于 A320 或 A319)', type: 'simple'}, 
      { id: '3_6', text: '6、后/散货舱地板，隔板，货网，seal 等安装正确，无 FOD。标牌完整', type: 'simple' },
      { id: '3_7', text: '7、后货舱侧壁板位置，顺序安装正确无误。', type: 'simple' },
      { id: '3_8', text: '8、散货舱门功能正常。（若安装）', type: 'simple' },
    ],
  },
  {
    id: 'section_4',
    title: '四、FAP 确保',
    items: [
      { id: '4_1', text: '1、清水，污水排空，FAP 显示正确。(根据客户要求是否排空)', type: 'simple' },
      { id: '4_2', text: '2、ECAM 门页面，显示正确。', type: 'simple' },
    ],
  },
  {
    id: 'section_6',
    title: '六、工具，货架确保',
    items: [
      { id: '6_1', text: '1、班组工具：篮子，各种螺丝盒是否齐全部并归位。', type: 'simple' },
      { id: '6_2', text: '2、零部件架所有零部件清理，并销毁“飞机信息标签”。', type: 'simple' },
    ],
  },
  {
    id: 'section_7',
    title: '七、离散设备确保',
    items: [
      { id: '7_1', text: '1. 离散设备工卡签署完成且附有“离散设备清单”和“离散设备摆放图复印件”；抽查离散设备胶纸已撕 (规定见离散设备 SOP)。', type: 'simple' },
    ],
  },
];