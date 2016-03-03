import bus from './../core/busModule.js';
import topics from './../topics.js';
import dataContext from './shopDataContext.js';

bus.subscribe(topics.SHOP.GET_ITEMS, dataContext.getItems);
bus.subscribe(topics.SHOP.ADD_ITEM, dataContext.addItem);
bus.subscribe(topics.SHOP.GET_ITEM, dataContext.getItem);
bus.subscribe(topics.SHOP.REMOVE_ITEM, dataContext.removeItem);