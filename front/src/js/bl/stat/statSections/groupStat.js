import bus from './../../core/busModule.js';
import topics from './../../topics.js';
import events from './../../events.js';

//Получение статистики по численности
function getGroupStat(data) {
    var group = data.group;
    var authData = data.authData;
    var period = data.period;

    var deferr = $.Deferred();
    var stat = [];

    getGroupStatRequest();

    function getGroupStatRequest() {
        bus.request(topics.VK.GET_STAT, authData, {
            groupId: group.gid,
            dateFrom: period.from,
            dateTo: period.to
        }).then(function (res) {
            if (res && !res.error) {
                res.forEach(function (dateStat, i) {
                    stat.push(dateStat);
                });
            }

            if (res && res.error) {
                switch (res.error.error_code) {
                    case 7:
                        //Статистика группы недоступна
                        stat = [];
                        break;
                    case 6:
                    {
                        setTimeout(()=> {
                            getGroupStatRequest();
                        }, 500);
                        return deferr.promise();
                    }
                }

            }

            deferr.resolve(stat);
        }).fail(function () {
            deferr.reject();
        });
    }

    return deferr.promise();
}

export default getGroupStat;