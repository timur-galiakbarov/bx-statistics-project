import bus from './../core/busModule.js';
import topics from './../topics.js';
import dataContext from './statDataContext.js';

bus.subscribe(topics.REPORTS.GET_BANNED_LIST, dataContext.getBannedList);
bus.subscribe(topics.REPORTS.GET_COMPARE_LIST, dataContext.getCompareList);
bus.subscribe(topics.REPORTS.GET_FIND_ANALOG_LIST, dataContext.getFindAnalogList);

bus.subscribe(topics.GET_CONTENT.GET_LIST, dataContext.getSectionList);