<script>
  export let title
</script>
<div class='w-full d-flex flex-row align-items-center pt-10 text-white {$$restProps.class}'>
  <hr class='w-full' />
  <div class='title position-absolute font-size-18 font-weight-semi-bold px-20'>{title}</div>
  <hr class='w-full' />
</div>

<style>
  .title {
    left: 50%;
    transform: translateX(-50%);
  }
  @media (hover: hover) and (pointer: fine) {
    .more:hover {
      color: var(--dm-link-text-color-hover) !important;
    }
  }
</style>
