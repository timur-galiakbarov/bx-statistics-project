<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
if (CModule::IncludeModule("iblock")) {
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "ACTIVE_FROM", "PROPERTY_USER_ID", "PROPERTY_BOOKMARKS");
    $arFilter = Array("IBLOCK_ID" => 2, "ACTIVE" => "Y", "PROPERTY_USER_ID" => $USER->GetID());
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);

    $bookmarksList = '';

    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $bookmarksList["id"] = $arFields["ID"];
        $bookmarksList["bookmarks"] = $arFields["PROPERTY_BOOKMARKS_VALUE"];
    }

    print_r(json_encode(Array("data" => $bookmarksList)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>