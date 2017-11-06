import bus from './../../core/busModule.js';
import topics from './../../topics.js';
import events from './../../events.js';

function getPhotoStat(data) {
    var group = data.group;
    var authData = data.authData;
    var period = data.period;

    var deferr = $.Deferred();

    var list = [];
    var flagStop = false;
    var iteration = 0;
    var maxIterations = 30;

    getPhotos();

    function getPhotos() {
        if (iteration >= maxIterations) {
            //newAlbums = 0;
            deferr.resolve({});
            return;
        }
        bus.request(topics.VK.GET_ALL_PHOTO, authData, {
            groupId: group.gid,
            count: 200,
            offset: iteration * 200,
            no_service_albums: 1,
            extended: 1
        }).then(function (res) {
            if (!res || res.error && res.error.error_code == 6) {
                setTimeout(function () {
                    getPhotos();
                }, 400);
                return;
            }
            if (res && res.items && res.items.length > 0) {
                res.items.forEach(function (photo) {
                    if (photo.date > period.unixFrom && photo.date < period.unixTo) {
                        list.push(photo);
                    } else if (photo.date <= period.unixFrom) {
                        flagStop = true;
                    }
                });
            } else {
                flagStop = true;
            }

            if (!flagStop) {
                iteration++;
                getPhotos();
            } else {
                deferr.resolve({
                    count: res.count,
                    list: list
                });
            }
        }).fail(function () {
            deferr.reject();
        });

    }

    return deferr.promise();
}

export default getPhotoStat;