<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
$iblockId = 3;

global $USER;
if (CModule::IncludeModule("iblock")) {

    //echo "<pre>"; print_r($_POST); echo "</pre>";

    //$groupId = str_replace("-", "", $_POST["postData"]["from_id"]);
    $groupId = $_POST["postData"]["from_id"];
    $postId = $groupId."_".$_POST["postData"]["id"];

    //print_r($postId);

    $arSelect = Array("ID", "NAME", "ACTIVE_FROM", "PROPERTY_POST_ID", "PROPERTY_USER_ID");
    $arFilter = Array("IBLOCK_ID" => $iblockId, "ACTIVE" => "Y", "PROPERTY_POST_ID" => $postId, "PROPERTY_USER_ID" => $USER->GetID());
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);
    $isPostExist = false;
    while ($ob = $res->GetNextElement()) {
        $isPostExist = true;
    }

    if ($isPostExist){
        print_r(json_encode(Array("success" => false, "exceptionType" => "AlreadyExist")));
        die();
    }

    $el = new CIBlockElement;

    $PROP = array();
    $PROP["POST_ID"] = $postId;
    $PROP["USER_ID"] = $USER->GetID();

    $arLoadProductArray = Array(
        "MODIFIED_BY" => $USER->GetID(),
        "IBLOCK_SECTION_ID" => false,
        "IBLOCK_ID" => $iblockId,
        "PROPERTY_VALUES" => $PROP,
        "NAME" => $USER->GetFullName(),
        "ACTIVE" => "Y"
    );

    $ID = '';

    $ID = $el->Add($arLoadProductArray);

    print_r(json_encode(Array("success" => true, "id" => $ID)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>