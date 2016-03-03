<?// подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?php
if ( !empty( $_FILES ) ) {
    $tempPath = $_FILES[ 'file' ][ 'tmp_name' ];
    global $USER;
    mkdir($_SERVER["DOCUMENT_ROOT"] . DIRECTORY_SEPARATOR . 'upload'.DIRECTORY_SEPARATOR.'temp'.DIRECTORY_SEPARATOR.$USER->GetID());
    mkdir($_SERVER["DOCUMENT_ROOT"] . DIRECTORY_SEPARATOR . 'upload'.DIRECTORY_SEPARATOR.'temp'.DIRECTORY_SEPARATOR.$USER->GetID().DIRECTORY_SEPARATOR."resize");
    $uploadPath = $_SERVER["DOCUMENT_ROOT"] . DIRECTORY_SEPARATOR . 'upload'.DIRECTORY_SEPARATOR.'temp'.DIRECTORY_SEPARATOR.$USER->GetID() . DIRECTORY_SEPARATOR . $_FILES[ 'file' ][ 'name' ];
    move_uploaded_file( $tempPath, $uploadPath );
    $answer = array( 'answer' => 'File transfer completed' );
    $json = json_encode( $answer );
    echo $json;
} else {
    echo 'No files';
}
?>
<?//----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/epilog_after.php");?>
