import bus from './../core/busModule.js';
import topics from './../topics.js';
import dataContext from './statDataContext.js';

bus.subscribe(topics.REPORTS.GET_BANNED_LIST, dataContext.getBannedList);
bus.subscribe(topics.REPORTS.GET_COMPARE_LIST, dataContext.getCompareList);
bus.subscribe(topics.REPORTS.GET_COMPARE_LIST_TXT, dataContext.getCompareListTxt);
bus.subscribe(topics.REPORTS.GET_FIND_ANALOG_LIST, dataContext.getFindAnalogList);

bus.subscribe(topics.GET_CONTENT.GET_LIST, dataContext.getSectionList);

//Аналитика
bus.subscribe(topics.STAT.GET_WALL, dataContext.stat.getWall);
bus.subscribe(topics.STAT.GET_GROUP_STAT, dataContext.stat.getGroupStat);
bus.subscribe(topics.STAT.GET_PHOTO, dataContext.stat.getPhoto);
bus.subscribe(topics.STAT.GET_PHOTO_COMMENTS, dataContext.stat.getPhotoComments);
bus.subscribe(topics.STAT.GET_VIDEO, dataContext.stat.getVideo);

//Запросы к ВКонтакте
bus.subscribe(topics.VK.GET_WALL, dataContext.vk.getWall);
bus.subscribe(topics.VK.GET_STAT, dataContext.vk.getStat);
bus.subscribe(topics.VK.GET_ALL_PHOTO, dataContext.vk.getAllPhoto);
bus.subscribe(topics.VK.GET_PHOTO_COMMENTS, dataContext.vk.getPhotoCommentsStat);
bus.subscribe(topics.VK.GET_VIDEO, dataContext.vk.getVideo);
bus.subscribe(topics.VK.GET_GROUP_INFO, dataContext.vk.getGroupInfo);
bus.subscribe(topics.VK.USERS_GET, dataContext.vk.getUsers);
bus.subscribe(topics.VK.IS_MEMBER, dataContext.vk.isMember);