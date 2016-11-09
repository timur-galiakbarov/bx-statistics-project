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
        "usersAll" => 0,
        "usersList" => Array(),
        "usersRegisterList" => Array(),
        "payCount" => 0
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

    $rsUsers = CUser::GetList(($by = "last_login"), ($order = "desc"), Array()); // выбираем пользователей

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
        $data["usersAll"]++;
    endwhile;

    $rsUsers = CUser::GetList(($by = "date_register"), ($order = "asc"), Array()); // выбираем пользователей

    while ($rsUsers->NavNext(true, "f_")) :
        $currUser = CUser::GetByID($f_ID)->GetNext();
        $currDate = date_parse_from_format("j.n.Y", $f_DATE_REGISTER);
        array_push($data["usersRegisterList"], Array(
            "dateRegister" => $currDate["month"].".".$currDate["day"].".".$currDate["year"]
        ));

    endwhile;


    $arSelect = Array("ID", "NAME", "DATE_ACTIVE_FROM");
    $arFilter = Array("IBLOCK_ID" => 4);
    $res = CIBlockElement::GetList(Array(), $arFilter, false, Array("nPageSize" => 50), $arSelect);
    while ($ob = $res->GetNextElement()) {
        $data["payCount"]++;
    }

    print_r(json_encode(Array("data" => $data)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>