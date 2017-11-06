<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
$iblockId = 6;

global $USER;
if (CModule::IncludeModule("iblock")) {
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "ACTIVE_FROM", "PROPERTY_USER_ID", "PROPERTY_FREE", "PROPERTY_FREE_WITH_VK_SUBSCRIBE");
    $arFilter = Array("IBLOCK_ID" => $iblockId, "ACTIVE" => "Y", "PROPERTY_USER_ID" => $USER->GetID());
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);
    $free = Array();
    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $free = $arFields;
    }

    if (!$free["PROPERTY_FREE_VALUE"]) {
        $free["PROPERTY_FREE_VALUE"] = Array();
    }

    if (!$free["PROPERTY_FREE_WITH_VK_SUBSCRIBE_VALUE"]) {
        $free["PROPERTY_FREE_WITH_VK_SUBSCRIBE_VALUE"] = Array();
    }

    foreach ($free["PROPERTY_FREE_VALUE"] as $key => $value) {
        foreach ($value as $keyGroup => $group) {
            if ($group == $_POST["group"]["screen_name"]) {
                print_r(json_encode(Array("success" => false, "exceptionType" => "ScreenNameAlreadyExist")));
                die();
            }
        }
    }

    foreach ($free["PROPERTY_FREE_WITH_VK_SUBSCRIBE_VALUE"] as $key => $value) {
        foreach ($value as $keyGroup => $group) {
            if ($group == $_POST["group"]["screen_name"]) {
                print_r(json_encode(Array("success" => false, "exceptionType" => "ScreenNameAlreadyExist")));
                die();
            }
        }
    }

    if ($_POST["source"] == "free") {
        if (count($free["PROPERTY_FREE_VALUE"]) >= 1) {
            print_r(json_encode(Array("success" => false, "exceptionType" => "FreeGroupsListIsFull")));
            die();
        }
    }

    if ($_POST["source"] == "bySubscribe") {
        if (count($free["PROPERTY_FREE_WITH_VK_SUBSCRIBE_VALUE"]) >= 2) {
            print_r(json_encode(Array("success" => false, "exceptionType" => "FreeGroupsBySubscribeListIsFull")));
            die();
        }
    }

    if ($_POST["source"] == "free") {
        array_push($free["PROPERTY_FREE_VALUE"], $_POST["group"]["screen_name"]);
    }

    if ($_POST["source"] == "bySubscribe") {
        array_push($free["PROPERTY_FREE_WITH_VK_SUBSCRIBE_VALUE"], $_POST["group"]["screen_name"]);
    }

    $el = new CIBlockElement;

    $PROP = array();
    $PROP["USER_ID"] = $USER->GetID();
    $PROP["FREE"] = $free["PROPERTY_FREE_VALUE"];
    $PROP["FREE_WITH_VK_SUBSCRIBE"] = $free["PROPERTY_FREE_WITH_VK_SUBSCRIBE_VALUE"];

    $arLoadProductArray = Array(
        "MODIFIED_BY" => $USER->GetID(),
        "IBLOCK_SECTION_ID" => false,
        "IBLOCK_ID" => $iblockId,
        "PROPERTY_VALUES" => $PROP,
        "NAME" => $USER->GetFullName(),
        "ACTIVE" => "Y"
    );

    $ID = '';

    if (!($free && $free["ID"])) {
        $ID = $el->Add($arLoadProductArray);
    } else {
        $el->Update($free["ID"], $arLoadProductArray);
        $ID = $free["ID"];
    }


    print_r(json_encode(Array("success" => true, "id" => $ID, "group" => $_POST["group"])));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>