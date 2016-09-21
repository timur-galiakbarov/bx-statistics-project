<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
$iblockId = 2;

global $USER;
if (CModule::IncludeModule("iblock")) {
    if (!$_POST["index"] && $_POST["index"] != 0) {
        print_r(json_encode(Array("success" => false, "exceptionType" => "notIndex")));
        die();
    }
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "ACTIVE_FROM", "PROPERTY_USER_ID", "PROPERTY_BOOKMARKS");
    $arFilter = Array("IBLOCK_ID" => $iblockId, "ACTIVE" => "Y", "PROPERTY_USER_ID_VALUE" => $USER->GetID());
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);
    $bookmarks = Array();
    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $bookmarks = $arFields;
    }

    if (count($bookmarks["PROPERTY_BOOKMARKS_VALUE"]) == 1){
        $bookmarks["PROPERTY_BOOKMARKS_VALUE"] = null;
    } else {
        array_splice($bookmarks["PROPERTY_BOOKMARKS_VALUE"], $_POST["index"], 1);
    }

    $ELEMENT_ID = $bookmarks["ID"];
    $PROPERTY_CODE = "BOOKMARKS";
    $PROPERTY_VALUE = $bookmarks["PROPERTY_BOOKMARKS_VALUE"];
    CIBlockElement::SetPropertyValuesEx($ELEMENT_ID, false, array($PROPERTY_CODE => $PROPERTY_VALUE));

    print_r(json_encode(Array("success" => true)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>