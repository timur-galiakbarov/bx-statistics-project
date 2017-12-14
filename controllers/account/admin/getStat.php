<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
global $USER;
if (CModule::IncludeModule("iblock")) {

    if (!$USER->isAdmin()) {
        print_r(json_encode(Array("error" => "noAccess")));
        die();
    }

    $data = Array(
        'usersAllToday' => 0,
        "usersNewToday" => 0,
        "usersOldToday" => 0,
        "usersAll" => CUser::GetCount(),
        "usersList" => Array(),
        "usersRegisterList" => Array(),
        "payCount" => 0,
        "payCountCurrentMonth" => 0,
        "payRurCurrentMonth" => 0,
        "payCountLastMonth" => 0,
        "payRurLastMonth" => 0,
        "payCountRur" => 0
    );

    $filter = Array
    (
        "LAST_LOGIN_1" => date("d.m.Y", mktime(0, 0, 0, date("m"), date("d"), date("Y"))),
        "LAST_LOGIN_2" => date("d.m.Y", mktime(0, 0, 0, date("m"), date("d"), date("Y")))
    );

    $rsUsers = CUser::GetList(($by = "last_login"), ($order = "desc"), $filter); // выбираем пользователей

    while ($rsUsers->NavNext(true, "f_")) :
        $dateRegister = date_parse_from_format("j.n.Y", $f_DATE_REGISTER);
        $mktimeRegister = mktime(0, 0, 0, $dateRegister["month"], $dateRegister["day"], $dateRegister["year"]);
        if ($mktimeRegister >= mktime(0, 0, 0, date("m"), date("d"), date("Y"))) {
            $data["usersNewToday"]++;
        } else {
            $data["usersOldToday"]++;
        }
        $data["usersAllToday"]++;
    endwhile;

    $period = date("d.m.Y", mktime(0, 0, 0, date("m"), date("d") - 2, date("Y")));
    $rsUsers = CUser::GetList(($by = "last_login"), ($order = "desc"), Array("LAST_LOGIN_1" => $period)); // выбираем пользователей за последние три дня

    while ($rsUsers->NavNext(true, "f_")) :
        $currUser = CUser::GetByID($f_ID)->GetNext();
        array_push($data["usersList"], Array(
            "name" => $f_NAME,
            "lastName" => $f_LAST_NAME,
            "login" => $f_LOGIN,
            "lastAuth" => $f_LAST_LOGIN,
            "dateRegister" => $f_DATE_REGISTER,
            "activeTo" => $currUser["UF_ACTIVE_TO"]
        ));
    endwhile;

    $arParams["NAV_PARAMS"] = array('nTopCount' => 200);
    $rsUsers = CUser::GetList(($by = "date_register"), ($order = "desc"), false, $arParams); // выбираем пользователей

    while ($rsUsers->NavNext(true, "f_")) :
        $currUser = CUser::GetByID($f_ID)->GetNext();
        $currDate = date_parse_from_format("j.n.Y", $f_DATE_REGISTER);
        array_push($data["usersRegisterList"], Array(
            "dateRegister" => $currDate["month"] . "." . $currDate["day"] . "." . $currDate["year"]
        ));

    endwhile;


    $arSelect = Array("ID", "NAME", "DATE_ACTIVE_FROM", "PROPERTY_SUMM", "CREATED_DATE");
    $arFilter = Array("IBLOCK_ID" => 4);
    $res = CIBlockElement::GetList(Array(), $arFilter, false, Array("nPageSize" => 999), $arSelect);
    $periodCurrentMonth = date_parse_from_format("j.n.Y", date("d.m.Y", mktime(0, 0, 0, date("m"), 1, date("Y"))));
    $periodLasttMonth = date_parse_from_format("j.n.Y", date("d.m.Y", mktime(0, 0, 0, date("m") - 1, 1, date("Y"))));
    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        /*print_r($arFields);*/
        $createdDate = date_parse_from_format("Y.n.j", $arFields["CREATED_DATE"]);
        /*print_r($createdDate);*/

        if ($createdDate >= $periodCurrentMonth) {
            $data["payCountCurrentMonth"]++;
            $data["payRurCurrentMonth"] += $arFields["PROPERTY_SUMM_VALUE"];
        }
        if ($createdDate >= $periodLasttMonth && $createdDate < $periodCurrentMonth) {
            $data["payCountLastMonth"]++;
            $data["payRurLastMonth"] += $arFields["PROPERTY_SUMM_VALUE"];
        }


        $data["payCountRur"] += $arFields["PROPERTY_SUMM_VALUE"];
        $data["payCount"]++;
    }

    print_r(json_encode(Array("data" => $data)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>