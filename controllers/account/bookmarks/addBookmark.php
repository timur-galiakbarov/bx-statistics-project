<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
$iblockId = 2;

global $USER;
if (CModule::IncludeModule("iblock")) {
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "ACTIVE_FROM", "PROPERTY_USER_ID", "PROPERTY_BOOKMARKS");
    $arFilter = Array("IBLOCK_ID" => $iblockId, "ACTIVE" => "Y", "PROPERTY_USER_ID" => $USER->GetID());
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);
    $bookmarks = Array();
    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $bookmarks = $arFields;
    }

    foreach ($bookmarks["PROPERTY_BOOKMARKS_VALUE"] as $key => $value){
        if ($value == $_POST["screenName"]){
            print_r(json_encode(Array("success" => false, "exceptionType" => "ScreenNameAlreadyExist")));
            die();
        }
    }

    if ($bookmarks["PROPERTY_BOOKMARKS_VALUE"])
        array_push($bookmarks["PROPERTY_BOOKMARKS_VALUE"], $_POST["screenName"]);
    else
        $bookmarks["PROPERTY_BOOKMARKS_VALUE"] = $_POST["screenName"];

    $el = new CIBlockElement;

    $PROP = array();
    $PROP["USER_ID"] = $USER->GetID();
    $PROP["BOOKMARKS"] = $bookmarks["PROPERTY_BOOKMARKS_VALUE"];

    $arLoadProductArray = Array(
        "MODIFIED_BY" => $USER->GetID(),
        "IBLOCK_SECTION_ID" => false,
        "IBLOCK_ID" => $iblockId,
        "PROPERTY_VALUES" => $PROP,
        "NAME" => $USER->GetFullName(),
        "ACTIVE" => "Y"
    );

    $ID = '';

    if (!($bookmarks && $bookmarks["ID"])) {
        $ID = $el->Add($arLoadProductArray);
    } else {
        $el->Update($bookmarks["ID"], $arLoadProductArray);
        $ID = $bookmarks["ID"];
    }


    print_r(json_encode(Array("id" => $ID)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>